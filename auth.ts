import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { canSignInAsync } from '@/lib/auth/gate';

// App-level Google sign-in (Auth.js). Edge-safe: no database or Node-only APIs here (rights
// resolution lives in lib/auth/rights.ts), so middleware.ts can import `auth` from this file.
//
// The Google provider is only registered when AUTH_GOOGLE_ID is set — locally there is none, and
// the synthetic identity in lib/auth/access.ts stands in, so the dev loop needs no OAuth setup.
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // behind the host's proxy (Render)
  // Dev mode never issues an Auth.js session (lib/auth/access.ts uses the synthetic identity), but
  // the middleware still wraps `auth()`, and Auth.js logs MissingSecret on every request without
  // one. A fixed placeholder OUTSIDE production keeps the dev log readable; in production the
  // variable is required and its absence still fails loudly.
  secret: process.env.AUTH_SECRET ?? (process.env.NODE_ENV !== 'production' ? 'dev-only-placeholder-not-a-secret' : undefined),
  providers: process.env.AUTH_GOOGLE_ID ? [Google] : [],
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ profile, user }) {
      // Google's own email_verified matters: an "External" consent screen could otherwise let
      // someone assert a Fountainhead address they do not control.
      if (profile && profile.email_verified === false) return false;
      // Ruling 13: the ORG LIST is resolved here (async) rather than read from a constant, so a
      // new campus domain works the day it is created. B1's staff-OU check rides along inside
      // canSignInAsync. Both are DORMANT until the Workspace service account is provisioned —
      // until then this answers exactly what the synchronous canSignIn() always did.
      return canSignInAsync(profile?.email ?? user?.email);
    },
  },
});
