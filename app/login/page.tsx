import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { authMode } from '@/lib/auth/mode';
import { getCurrentUser } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const mode = authMode();
  // Already signed in (or in dev mode, where the synthetic identity is always present) → the POSH / POCSO page.
  if (mode !== 'closed' && (await getCurrentUser())) redirect('/');

  return (
    <main className="wall">
      <div className="card">
        <div className="logo">
          School Safety HQ
          <small>Fountainhead Schools · safety compliance (prototype)</small>
        </div>

        {mode === 'google' && (
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/' });
            }}
          >
            <button type="submit" className="btn block">
              Sign in with Google
            </button>
          </form>
        )}

        {mode === 'closed' && (
          <div className="alert bad">
            Sign-in is not configured. This deployment has no Google client set, so it refuses everyone rather than
            letting anyone in unauthenticated. Set <code>AUTH_GOOGLE_ID</code> and <code>AUTH_GOOGLE_SECRET</code>.
          </div>
        )}

        {mode === 'dev' && (
          <div className="alert info">
            Running in development mode with a synthetic identity. Set <code>AUTH_GOOGLE_ID</code> to use real
            Google sign-in.
          </div>
        )}

        <p className="note">
          Use your school Google account. Signing in lets you see the records; changing one needs a grant for that unit.
        </p>
      </div>
    </main>
  );
}
