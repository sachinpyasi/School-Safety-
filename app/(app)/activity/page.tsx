import { requireUser } from '@/lib/auth/guard';
import { getActivity, ACTIVITY_ROW_CAP } from '@/lib/activity';
import { nowIst } from '@/lib/clock';
import {
  resolveActivityScope,
  enforceSelfView,
  actionLabel,
  actionShort,
  actionClass,
  registerTimeLabel,
  daysBefore,
  summariseDetail,
  SIGN_IN_WINDOW_MS,
  DAY_START_HOUR,
  DAY_END_HOUR,
  type ActivityScope,
  type ActivityPresence,
} from '@/engine/activity';

// Activity: who signed in, and what they changed. Built to REGISTER-SPEC / the 04-Sep-2026
// rulings from the first commit (docs/RULES.md §Activity): a 24-hour presence strip with
// role="img", a dense register of DECISIONS with sign-ins demoted to the strip and `?signins=1` to
// put them back, and ruling 3's split — RIGHTS_ADMIN_EMAILS see everyone, everyone else sees only
// themselves. `enforceSelfView` runs AFTER the URL is parsed, so a crafted `?actor=` cannot widen a
// non-admin's view.
//
// Hand-rolled strip rather than the design system's <HourStrip/>: this app carries no DS dependency
// (CLAUDE.md §Why no design system), the same position front-desk is in.

export const dynamic = 'force-dynamic';

function dayLabel(d: string): string {
  const [y, m, day] = d.split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${MONTHS[Number(m) - 1]}-${y}`;
}
function scopeLabel(s: ActivityScope, canSeeEveryone: boolean): string {
  const bits = [s.from === s.to ? dayLabel(s.from) : `${dayLabel(s.from)} – ${dayLabel(s.to)}`];
  if (canSeeEveryone && s.actor) bits.push(`“${s.actor}”`);
  if (s.action) bits.push(actionLabel(s.action).toLowerCase());
  return bits.join(' · ');
}
function qs(params: Record<string, string | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  return u.toString();
}
function plural(n: number, singular: string, pluralWord = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}
function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}
// Caption + aria-label from one function so they can never drift apart (spec §1).
function presenceCopy(p: ActivityPresence): { caption: string; aria: string } {
  const dayNote = p.days === 1 ? '' : ` over ${p.days} days`;
  const outOfHoursNote =
    p.outOfHours > 0 ? `, ${p.outOfHours} outside ${hourLabel(DAY_START_HOUR)}–${hourLabel(DAY_END_HOUR)}` : '';
  const caption = `When people were here${dayNote} · ${plural(p.total, 'sign-in')} from ${plural(p.people, 'person', 'people')}${outOfHoursNote}`;
  const max = Math.max(...p.hours);
  const busiestHour = max > 0 ? p.hours.indexOf(max) : -1;
  return { caption, aria: busiestHour >= 0 ? `${caption}, busiest at ${hourLabel(busiestHour)} with ${max}` : caption };
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; actor?: string; action?: string; signins?: string }>;
}) {
  const user = await requireUser();
  const canSeeEveryone = user.isRightsAdmin;

  const sp = await searchParams;
  const today = nowIst();
  const scope = enforceSelfView(resolveActivityScope(sp, today), canSeeEveryone, user.email);
  const d = await getActivity(scope);
  const me = d.people.find((p) => p.actorEmail === user.email.toLowerCase()) ?? null;

  const week = daysBefore(today, 6);
  const month = daysBefore(today, 29);
  const preset = (from: string, to: string) => (scope.from === from && scope.to === to ? ' on' : '');
  // `signins` rides along on every preset chip exactly like actor/action do (spec §2's round-trip).
  const keep = { actor: canSeeEveryone ? scope.actor : undefined, action: scope.action, signins: scope.withSignIns ? '1' : undefined };
  const windowHours = Math.round(SIGN_IN_WINDOW_MS / 3_600_000);
  const singleDay = scope.from === scope.to;
  const max = Math.max(1, ...d.presence.hours);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="sub">
            {canSeeEveryone
              ? `${scopeLabel(scope, canSeeEveryone)} · ${plural(d.total, 'action')} · ${plural(d.presence.people, 'person', 'people')} present`
              : `Your own activity only · ${scopeLabel(scope, canSeeEveryone)} · your ${plural(me?.signIns ?? 0, 'sign-in')} · your ${plural(me?.actions ?? 0, 'action')}`}
          </p>
        </div>
        <div className="chips">
          <a href={`?${qs({ from: today, to: today, ...keep })}`} className={`chip${preset(today, today)}`}>
            Today
          </a>
          <a href={`?${qs({ from: week, to: today, ...keep })}`} className={`chip${preset(week, today)}`}>
            Last 7 days
          </a>
          <a href={`?${qs({ from: month, to: today, ...keep })}`} className={`chip${preset(month, today)}`}>
            Last 30 days
          </a>
        </div>
      </div>

      {/* Filters — plain GET form (bookmarkable URLs). The Person field is rendered ONLY for the
          estate-wide viewer (ruling 3): enforceSelfView would discard it either way, but showing a
          control that cannot do what it looks like it does is its own kind of dishonesty. */}
      <div className="card">
        <form method="get" className="row">
          <div className="field">
            <label htmlFor="from">From</label>
            <input id="from" type="date" name="from" defaultValue={scope.from} max={scope.to} />
          </div>
          <div className="field">
            <label htmlFor="to">To</label>
            <input id="to" type="date" name="to" defaultValue={scope.to} min={scope.from} />
          </div>
          {canSeeEveryone && (
            <div className="field">
              <label htmlFor="actor">Person (email contains)</label>
              <input id="actor" type="search" name="actor" defaultValue={scope.actor ?? ''} placeholder="anyone" />
            </div>
          )}
          <div className="field">
            <label htmlFor="action">Action</label>
            <select id="action" name="action" defaultValue={scope.action ?? ''}>
              <option value="">All actions</option>
              {scope.action && !d.actions.some((a) => a.action === scope.action) && (
                <option value={scope.action}>{actionLabel(scope.action)} (0)</option>
              )}
              {d.actions.map((a) => (
                <option key={a.action} value={a.action}>
                  {actionLabel(a.action)} ({a.n})
                </option>
              ))}
            </select>
          </div>
          {scope.withSignIns && <input type="hidden" name="signins" value="1" />}
          <button type="submit" className="btn">
            Apply
          </button>
        </form>
      </div>

      {/* Presence strip (spec §1). Estate-wide only — a self-view shows nobody but the viewer, so a
          24-hour shape adds nothing there (the `me` counts in the header cover it). 24 bars,
          bottom-aligned, height = % of the busiest hour with a floor so a true zero still reads as
          a bar rather than a gap. */}
      {canSeeEveryone &&
        (() => {
          const { caption, aria } = presenceCopy(d.presence);
          return (
            <div className="card">
              <p className="note" style={{ marginBottom: 8 }}>
                {caption}
              </p>
              <div className="strip" role="img" aria-label={aria}>
                {d.presence.hours.map((n, h) => (
                  <div
                    key={h}
                    className={`bar${h < DAY_START_HOUR || h >= DAY_END_HOUR ? ' off' : ''}`}
                    style={{ height: `${Math.max(3, Math.round((n / max) * 100))}%` }}
                    title={`${hourLabel(h)} · ${plural(n, 'sign-in')}`}
                  />
                ))}
              </div>
              <div className="strip-hours" aria-hidden="true">
                {d.presence.hours.map((_, h) => (
                  <span key={h}>{String(h).padStart(2, '0')}</span>
                ))}
              </div>
              <p className="note" style={{ marginTop: 10 }}>
                A sign-in is counted once per person per {windowHours} hours, so this is &ldquo;when people used the
                app&rdquo;, not a visit log.
              </p>
            </div>
          );
        })()}

      {/* The register (spec §2): only decisions, dense, monospaced. Sign-in rows are excluded by
          default (lib/activity.ts); the toggle below puts them back without touching the strip. */}
      <div className="card">
        <h2>{canSeeEveryone ? 'What they did' : 'What you did'}</h2>
        {d.rows.length === 0 ? (
          <p className="muted">No entries in this range.</p>
        ) : (
          <div className="table-wrap">
            <table className="table mono">
              <thead>
                <tr>
                  <th>Time</th>
                  {canSeeEveryone && <th>Who</th>}
                  <th>Action</th>
                  <th>Target</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap muted">{registerTimeLabel(r.at, singleDay)}</td>
                    {canSeeEveryone && <td className="clip">{r.actorEmail}</td>}
                    <td className="nowrap">
                      <a
                        href={`?${qs({ from: scope.from, to: scope.to, actor: keep.actor, action: r.action, signins: keep.signins })}`}
                        title={actionLabel(r.action)}
                      >
                        <span className={`badge ${actionClass(r.action)}`}>{actionShort(r.action)}</span>
                      </a>
                    </td>
                    <td className="clip muted">{r.subject ?? ''}</td>
                    <td className="clip muted" style={{ maxWidth: 420 }}>
                      {summariseDetail(r.detail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.total > d.rows.length && (
          <p className="note" style={{ marginTop: 10 }}>
            Showing the latest {ACTIVITY_ROW_CAP} of {d.total}. Narrow the range or filter by{' '}
            {canSeeEveryone ? 'person or ' : ''}action to see the rest.
          </p>
        )}
        <p className="note" style={{ marginTop: 10 }}>
          {scope.withSignIns ? (
            <>
              Sign-in rows are included.{' '}
              <a href={`?${qs({ from: scope.from, to: scope.to, actor: keep.actor, action: scope.action })}`}>Hide them</a>.
            </>
          ) : (
            <>
              {canSeeEveryone ? 'Sign-ins are in the strip above.' : 'Your sign-ins are not shown as rows by default.'}{' '}
              <a href={`?${qs({ from: scope.from, to: scope.to, actor: keep.actor, action: scope.action, signins: '1' })}`}>
                Show them as rows too
              </a>
              .
            </>
          )}
        </p>
      </div>
    </>
  );
}
