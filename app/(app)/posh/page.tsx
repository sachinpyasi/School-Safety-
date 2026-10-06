import { requireUser } from '@/lib/auth/guard';
import { grantsOf } from '@/lib/rights';
import { recordsFor, yearsWithRecords } from '@/lib/posh';
import { nowIst } from '@/lib/clock';
import { canEditUnit } from '@/engine/rights';
import {
  POSH_ACTS,
  DUE_SOON_DAYS,
  academicYear,
  buildCards,
  summarise,
  parseYear,
  parseAct,
  yearLabel,
  dayLabel,
  type PoshCard,
} from '@/engine/posh';
import { fmtDateTime } from '@/engine/ist';
import { saveAction, deleteYearAction } from './actions';
import { ConfirmForm } from '../_ConfirmForm';

export const dynamic = 'force-dynamic';

// POSH / POCSO: seven units × two Acts × one academic year, as counts. A plain server component:
// the year and Act live in the URL (so a view can be sent to somebody), every edit is a form post,
// and it all works without JavaScript. The legacy page's tap-a-figure grid is NOT ported. It is a
// quick way to change one number, and a number box does the same job on a phone.

function qs(params: Record<string, string | number | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') u.set(k, String(v));
  return u.toString();
}

function dueNote(c: PoshCard): string {
  if (!c.lastTraining || !c.due) return 'no session date yet';
  const left = c.daysLeft ?? 0;
  const tail = left < 0 ? `${Math.abs(left)} days overdue` : `${left} days left`;
  return `trained ${dayLabel(c.lastTraining)} · due ${dayLabel(c.due)} · ${tail}`;
}

export default async function PoshPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; act?: string; ok?: string; error?: string; open?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = nowIst();
  const current = academicYear(today);
  const year = parseYear(sp.year, current);
  const act = parseAct(sp.act);

  const [rows, stored, grants] = await Promise.all([recordsFor(year, act), yearsWithRecords(), grantsOf(user)]);
  const cards = buildCards(rows, today);
  const sum = summarise(cards);
  const years = [...new Set([current, ...stored])].sort((a, b) => b - a);
  const byUnit = new Map(rows.map((r) => [r.unit, r]));
  const editable = (unit: string) => canEditUnit(grants, user.isRightsAdmin, unit);
  const anyEditable = cards.some((c) => editable(c.unit));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>POSH / POCSO</h1>
          <p className="sub">
            Annual training compliance · {act} · academic year {yearLabel(year)} (June to May)
          </p>
        </div>
        <div className="row">
          <div className="chips" aria-label="Act">
            {POSH_ACTS.map((a) => (
              <a key={a} href={`?${qs({ year, act: a })}`} className={`chip${a === act ? ' on' : ''}`}>
                {a}
              </a>
            ))}
          </div>
          <form method="get" className="row">
            <input type="hidden" name="act" value={act} />
            <label className="sr-only" htmlFor="year">
              Academic year
            </label>
            <select id="year" name="year" defaultValue={String(year)} className="compact">
              {years.map((y) => (
                <option key={y} value={y}>
                  {yearLabel(y)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn ghost sm">
              Show
            </button>
          </form>
          <a className="btn ghost sm" href={`/posh/export?${qs({ year, act })}`}>
            Download CSV
          </a>
          {user.isRightsAdmin && (
            <a className="btn ghost sm" href="/posh/import">
              Import from old portal
            </a>
          )}
        </div>
      </div>

      {sp.ok && (
        <div className="alert ok" role="status">
          {sp.ok}
        </div>
      )}
      {sp.error && (
        <div className="alert bad" role="alert">
          {sp.error}
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <b>{sum.employees}</b>
          <span>Total employees</span>
        </div>
        <div className="kpi good">
          <b>{sum.trained}</b>
          <span>Trained</span>
        </div>
        <div className="kpi bad">
          <b>{sum.pending}</b>
          <span>Still to train</span>
        </div>
        <div className="kpi">
          <b>{sum.overallPct === null ? '—' : `${sum.overallPct}%`}</b>
          <span>Overall</span>
        </div>
        <div className="kpi good">
          <b>{sum.unitsComplete}</b>
          <span>Units complete</span>
        </div>
        <div className="kpi warn">
          <b>{sum.unitsPending}</b>
          <span>Units pending</span>
        </div>
      </div>
      {sum.unitsNotStarted > 0 && (
        <p className="note">
          {sum.unitsNotStarted} of 7 units have no headcount for {act} {yearLabel(year)} yet, so they are left out of the
          figures above.
        </p>
      )}

      <div className="posh-grid">
        {cards.map((c) => {
          const can = editable(c.unit);
          const stored = byUnit.get(c.unit);
          return (
            <div key={c.unit} className={`card posh-card band-${c.band.key}`}>
              <div className="posh-hd">
                <div>
                  <h2>{c.name}</h2>
                  <p className="sub">
                    {c.total ? (
                      <>
                        <b>{c.completed ?? 0}</b> of <b>{c.total}</b> trained · {c.pct}%
                      </>
                    ) : (
                      'headcount not set'
                    )}
                  </p>
                </div>
                <span className={`status band-${c.band.key}`}>{c.band.label}</span>
              </div>
              {c.total ? (
                <div
                  className="meter"
                  role="img"
                  aria-label={`${c.name}: ${c.completed ?? 0} of ${c.total} trained, ${c.pct}%`}
                >
                  <i style={{ width: `${c.pct}%` }} />
                </div>
              ) : null}
              <p className="note">{dueNote(c)}</p>
              {c.comments && <p className="note">Note: {c.comments}</p>}
              {stored && (
                <p className="note faint">
                  Last changed {fmtDateTime(stored.updatedAt)} by {stored.updatedBy}
                </p>
              )}
              {can && (
                <details open={sp.open === c.unit}>
                  <summary>Edit {c.name}</summary>
                  <form action={saveAction} className="posh-form">
                    <input type="hidden" name="year" value={year} />
                    <input type="hidden" name="act" value={act} />
                    <input type="hidden" name="unit" value={c.unit} />
                    <div className="field">
                      <label htmlFor={`t-${c.unit}`}>Total employees</label>
                      <input id={`t-${c.unit}`} name="totalEmployees" type="number" min={0} inputMode="numeric" defaultValue={c.total ?? ''} />
                    </div>
                    <div className="field">
                      <label htmlFor={`d-${c.unit}`}>Trained</label>
                      <input id={`d-${c.unit}`} name="completed" type="number" min={0} inputMode="numeric" defaultValue={c.completed ?? ''} />
                    </div>
                    <div className="field">
                      <label htmlFor={`l-${c.unit}`}>Last training</label>
                      <input id={`l-${c.unit}`} name="lastTraining" type="date" defaultValue={c.lastTraining ?? ''} />
                    </div>
                    <div className="field wide">
                      <label htmlFor={`c-${c.unit}`}>Note</label>
                      <input id={`c-${c.unit}`} name="comments" type="text" maxLength={500} placeholder="optional" defaultValue={c.comments ?? ''} />
                    </div>
                    <button type="submit" className="btn">
                      Save
                    </button>
                  </form>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <p className="note">
        Renewal falls due a year after the last session, and shows as due soon inside {DUE_SOON_DAYS} days.
        {!anyEditable && ' You can see every record; changing one needs a grant for that unit (see Who can edit).'}
      </p>

      {user.isRightsAdmin && stored.includes(year) && (
        <div className="card">
          <h2>Delete {yearLabel(year)}</h2>
          <p className="sub" style={{ marginBottom: 10 }}>
            Removes every unit&rsquo;s record for {yearLabel(year)}, under both Acts. This cannot be undone here.
          </p>
          <ConfirmForm action={deleteYearAction} message={`Delete every POSH and POCSO record for ${yearLabel(year)}?`} className="row">
            <input type="hidden" name="year" value={year} />
            <div className="field">
              <label htmlFor="confirm">Type {year} to confirm</label>
              <input id="confirm" name="confirm" type="text" inputMode="numeric" autoComplete="off" required />
            </div>
            <button type="submit" className="btn danger">
              Delete the year
            </button>
          </ConfirmForm>
        </div>
      )}
    </>
  );
}
