// getCurrentUser — the Node-side identity resolver used by pages, routes and server
// actions. Branches on authMode() so a prod misconfig fails shut, never falling through to the dev
// identity.
//
// Identity ONLY. What a person may do is a separate question, answered by lib/rights.ts.
//
// Memoised per request with React `cache` (zero arguments — a `cache()` keyed on an object never
// hits). The admin layout and the page it wraps each resolve the user, so without this the presence
// note below would write two `sign_in` rows per page view instead of one.
import { cache } from 'react';
import { auth } from '@/auth';
import { authMode } from './mode';
import { notePresenceSafely } from './presence';

export interface SignedInUser {
  email: string;
  name: string;
  /** On RIGHTS_ADMIN_EMAILS — may give and take away grants, may edit every unit, and may delete a
   *  year. Independent of any DB row. */
  isRightsAdmin: boolean;
}

/** Fails CLOSED to the owner (Sachin): an unset RIGHTS_ADMIN_EMAILS must not mean "nobody", or
 *  the first grant could never be made and every record would be permanently read-only. Set the
 *  variable on the host to add or change administrators. */
export function rightsAdminEmails(env: Record<string, string | undefined> = process.env): string[] {
  const configured = (env.RIGHTS_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return configured.length > 0
    ? configured
    : ['sachin.pyasi@fountainheadschools.org'];
}

export function isRightsAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return rightsAdminEmails().includes(email.trim().toLowerCase());
}

/** Turn an email local part into something presentable when Google gives us no display name. */
export function prettyName(email: string): string {
  const local = email.split('@')[0] ?? email;
  const words = local.split(/[._-]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return words.join(' ') || email;
}

export const getCurrentUser = cache(async (): Promise<SignedInUser | null> => {
  const mode = authMode();
  if (mode === 'closed') return null;

  if (mode === 'dev') {
    // Local development only: a synthetic identity so the app is exercisable without an OAuth
    // client. Unreachable in production — authMode() returns 'closed' there instead.
    const email = (process.env.DEV_USER_EMAIL ?? 'dev@fountainheadschools.org').toLowerCase();
    const user = { email, name: prettyName(email), isRightsAdmin: true };
    await notePresenceSafely(user.email, user.name);
    return user;
  }

  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  const user = {
    email,
    name: session?.user?.name?.trim() || prettyName(email),
    isRightsAdmin: isRightsAdminEmail(email),
  };
  // "Who signed in" — one audit row per person per working day (lib/auth/presence.ts).
  await notePresenceSafely(user.email, user.name);
  return user;
});
