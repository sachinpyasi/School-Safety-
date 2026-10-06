'use client';

import { useActionState } from 'react';
import { previewAction, confirmAction, type PreviewState } from './actions';
import type { ImportRow } from '@/engine/posh-import';
import { dayLabel, unitName, yearLabel } from '@/engine/posh';

// Step 1 uploads and asks the server for a preview; step 2 shows EXACTLY what will be saved and sends
// the same files back to be imported. The server works the plan out again on Confirm.

const KIND: Record<ImportRow['outcome']['kind'], { label: string; cls: string }> = {
  create: { label: 'will be saved', cls: 'band-ok' },
  existing: { label: 'skipped, already here', cls: 'band-open' },
  empty: { label: 'skipped, empty', cls: 'band-none' },
  refused: { label: 'refused', cls: 'band-expired' },
};

function detail(r: ImportRow): string {
  const o = r.outcome;
  if (o.kind === 'refused') return o.reason;
  if (o.kind === 'empty') return 'Nothing filled in on the old portal.';
  const v = o.record;
  return [
    `${v.act} · ${unitName(v.unit)} · ${yearLabel(v.year)}`,
    `total ${v.totalEmployees ?? '—'}`,
    `completed ${v.completed ?? '—'}`,
    `last training ${v.lastTraining ? dayLabel(v.lastTraining) : '—'}`,
    v.comments ? `note: ${v.comments}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function ImportForm() {
  const [state, upload, pending] = useActionState<PreviewState, FormData>(previewAction, { stage: 'upload' });

  if (state.stage === 'upload') {
    return (
      <div className="card">
        <h2>1. Choose the files</h2>
        <p className="sub" style={{ marginBottom: 10 }}>
          The old portal&rsquo;s POSH / POCSO &ldquo;⬇ CSV&rdquo; files. Several at once is fine. Nothing is saved until you
          confirm the preview.
        </p>
        {state.error && (
          <div className="alert bad" role="alert" style={{ marginBottom: 10 }}>
            {state.error}
          </div>
        )}
        <form action={upload} className="row">
          <div className="field">
            <label htmlFor="files">CSV files</label>
            <input id="files" name="files" type="file" accept=".csv,text/csv" multiple required />
          </div>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? 'Reading…' : 'Show the preview'}
          </button>
        </form>
      </div>
    );
  }

  const { plan, files } = state;
  const c = plan.counts;
  return (
    <>
      <div className="card">
        <h2>2. Check the preview</h2>
        <div className="kpis" style={{ margin: '6px 0 10px' }}>
          <div className="kpi good">
            <b>{c.create}</b>
            <span>Will be saved</span>
          </div>
          <div className="kpi warn">
            <b>{c.existing}</b>
            <span>Already here (skipped)</span>
          </div>
          <div className="kpi">
            <b>{c.empty}</b>
            <span>Empty (skipped)</span>
          </div>
          <div className="kpi bad">
            <b>{c.refused + plan.fileErrors.length}</b>
            <span>Refused</span>
          </div>
        </div>
        {plan.fileErrors.map((e) => (
          <div key={e.file} className="alert bad" role="alert" style={{ marginBottom: 8 }}>
            {e.file}: {e.reason}
          </div>
        ))}
        <p className="note">
          Copied exactly as the old portal has them: Year, Act, Unit, Total employees, Completed, Last training and Comments.
          Pending, %, Status and Next due are worked out by this app. A record that is already here is never changed.
        </p>
      </div>

      {plan.rows.length > 0 && (
        <div className="card">
          <ul className="import-list">
            {plan.rows.map((r) => (
              <li key={`${r.file}:${r.line}`} className={`import-row kind-${r.outcome.kind}`}>
                <div className="import-hd">
                  <b>{r.label}</b>
                  <span className={`status ${KIND[r.outcome.kind].cls}`}>{KIND[r.outcome.kind].label}</span>
                </div>
                <p className="note">{detail(r)}</p>
                <p className="note faint">
                  {r.file} · line {r.line}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card row">
        {c.create > 0 ? (
          <form action={confirmAction}>
            <input type="hidden" name="payload" value={JSON.stringify(files)} />
            <button type="submit" className="btn">
              Confirm: save {c.create} record{c.create === 1 ? '' : 's'}
            </button>
          </form>
        ) : (
          <p className="note">Nothing new to save from these files.</p>
        )}
        <a href="/posh/import" className="btn ghost">
          Cancel
        </a>
      </div>
    </>
  );
}
