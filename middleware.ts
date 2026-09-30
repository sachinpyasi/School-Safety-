import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { authMode } from '@/lib/auth/mode';
import { isPublicPath } from '@/lib/auth/public-routes';

/**
 * Hosts that must BOUNCE to the canonical origin (the AUTH_URL host) — ONE canonical host per app
 * (docs/RULES.md §Sign-in). An EXPLICIT list, never "anything that isn't canonical": a host's
 * healthchecks arrive under hosts nobody enumerates, and bouncing those fails the healthcheck and
 * blocks every deploy. Fail OPEN on unknown hosts.
 *
 * Why: a sign-in STARTED on the host's own address (e.g. *.onrender.com) sets its PKCE cookie on that origin, but AUTH_URL
 * pins Google's callback to the custom domain, which then arrives cookie-less and Auth.js shows
 * "There is a problem with the server configuration".
 *
 * EMPTY while the app has only one address. If it ever gets a custom domain, AUTH_URL moves to it
 * and the host's own address (e.g. school-safety.onrender.com) goes in this list, so old links
 * bounce to the new home instead of breaking sign-in.
 */
const NONCANONICAL_HOSTS = new Set<string>([]);

// The authentication gate. The active source is decided by authMode() so the app can never silently
// run unauthenticated in production:
//   - google: bounce anonymous browsers to /login (which itself + the Auth.js endpoints stay public).
//   - dev:    no-op so the local synthetic identity works without a Google round-trip.
//   - closed: production with no real auth source configured — fail shut (503).
export default auth((req) => {
  const host = req.headers.get('host')?.toLowerCase() ?? '';
  const canonical = process.env.AUTH_URL;
  if (canonical && NONCANONICAL_HOSTS.has(host) && (req.method === 'GET' || req.method === 'HEAD')) {
    let canonicalHost = '';
    try {
      canonicalHost = new URL(canonical).host.toLowerCase();
    } catch {
      canonicalHost = '';
    }
    // Inert while AUTH_URL still names the alias itself — bouncing a host to itself is a loop.
    if (canonicalHost && canonicalHost !== host) {
      return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, canonical), 308);
    }
  }

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return;

  const mode = authMode();
  if (mode === 'google') {
    if (req.auth) return;
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
  }
  if (mode === 'closed') {
    return new NextResponse('Authentication is not configured.', { status: 503 });
  }
  return; // dev
});

export const config = {
  // Everything except Next internals and static assets. Public routes stay IN scope here (matched,
  // then let through by isPublicPath) so there is one place to read the whole list.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|svg|ico|webp|gif)).*)'],
};
