import { requireUser } from '@/lib/auth/guard';
import { mayEditAnything } from '@/lib/rights';

export const dynamic = 'force-dynamic';

// The chrome for every signed-in page. A top bar, not a sidebar: three pages do not need one, and a
// sidebar would need a mobile drawer (a sticky sidebar breaks on phones) for no gain. Any signed-in colleague may open every page. What they may DO is decided per action.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const editor = await mayEditAnything(user);

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <a href="/posh" className="brand">
            School Safety HQ <small>· prototype</small>
          </a>
          <nav aria-label="Pages">
            <a href="/posh">POSH / POCSO</a>
            <a href="/rights">Who can edit</a>
            <a href="/activity">Activity</a>
          </nav>
          <div className="me">
            <span>
              {user.name}
              {user.isRightsAdmin ? ' · administrator' : editor ? ' · editor' : ''}
            </span>
            <a href="/logout" className="linkbtn">
              Sign out
            </a>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
