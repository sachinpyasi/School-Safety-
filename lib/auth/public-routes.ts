// Which paths the auth gate in middleware.ts lets through untouched.
//
// Its own module so it can be unit-tested directly, and edge-bundle-safe: ZERO imports.
//
// - `/api/health` — the container liveness probe. Must answer BEFORE any auth source is configured:
//   production with no AUTH_* vars is authMode() 'closed', which 503s everything else by design. A
//   gated health check leaves the host's deploy never going live. Exact match, not a prefix.
// - `/api/auth`, `/login` — the sign-in flow itself; gating it is a redirect loop.
//
// Everything else is behind sign-in, the POSH / POCSO page included: its counts are not personal
// data, but they are the school's compliance record and the legacy portal never showed them to an
// anonymous visitor either.
export function isPublicPath(pathname: string): boolean {
  return pathname === '/api/health' || pathname.startsWith('/api/auth') || pathname === '/login';
}
