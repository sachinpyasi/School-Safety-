import { signOut } from '@/auth';
import { authMode } from '@/lib/auth/mode';

export const dynamic = 'force-dynamic';

// A page, not a link that signs out on GET: signing out is a state change, and a browser prefetching
// the footer link would otherwise log people out of their own start page.
export default function LogoutPage() {
  const mode = authMode();
  return (
    <main className="wall">
      <div className="card">
        <div className="logo">
          Sign out?
          <small>You will need to sign in again the next time you open School Safety HQ.</small>
        </div>
        {mode === 'google' ? (
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="btn block">
              Sign out
            </button>
          </form>
        ) : (
          <div className="alert info">There is no Google session to end in {mode} mode.</div>
        )}
        <p className="note">
          <a href="/">Back to School Safety HQ</a>
        </p>
      </div>
    </main>
  );
}
