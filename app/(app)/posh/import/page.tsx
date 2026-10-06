import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guard';
import { ImportForm } from './_ImportForm';

export const dynamic = 'force-dynamic';

// "Import from old portal": administrators only (the actions re-check on the server). Upload the old
// portal's POSH / POCSO CSV files → a preview of exactly what will be saved → Confirm.

export default async function PoshImportPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; existing?: string; empty?: string; refused?: string; error?: string }>;
}) {
  const user = await requireUser();
  if (!user.isRightsAdmin) redirect(`/posh?${new URLSearchParams({ error: 'Only an administrator can import from the old portal.' })}`);
  const sp = await searchParams;
  const n = (v?: string) => (/^\d+$/.test(v ?? '') ? Number(v) : 0);
  const done = sp.created !== undefined;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Import from old portal</h1>
          <p className="sub">POSH / POCSO records, copied exactly. Existing records are never overwritten.</p>
        </div>
        <a href="/posh" className="btn ghost sm">
          Back to POSH / POCSO
        </a>
      </div>

      {sp.error && (
        <div className="alert bad" role="alert">
          {sp.error}
        </div>
      )}
      {done && (
        <div className="alert ok" role="status">
          Imported {n(sp.created)} record{n(sp.created) === 1 ? '' : 's'}. Skipped {n(sp.existing)} already here and{' '}
          {n(sp.empty)} empty. Refused {n(sp.refused)}. It is on the Activity page.
        </div>
      )}

      <ImportForm />
    </>
  );
}
