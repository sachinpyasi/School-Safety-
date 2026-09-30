/**
 * Which authentication source is active, decided ONCE from the environment. Both the edge
 * middleware and getCurrentUser branch on this, so "dev mode" can NEVER be entered by mere
 * env-absence in production: with no real auth source configured in prod the mode is 'closed' and
 * the app fails shut (503) rather than falling through to an unauthenticated identity.
 *
 * That matters more here than in most of the estate. This app holds a live, paired WhatsApp session
 * for a school number; an unauthenticated fall-through would hand a stranger the ability to send
 * from it.
 *
 * Pure + edge-safe (reads only env, imports nothing) so the middleware bundle can use it.
 */
export type AuthMode = 'google' | 'dev' | 'closed';

export function authMode(env: Record<string, string | undefined> = process.env): AuthMode {
  if (env.AUTH_GOOGLE_ID) return 'google';
  if (env.NODE_ENV !== 'production') return 'dev';
  return 'closed';
}
