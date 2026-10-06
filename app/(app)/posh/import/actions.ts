'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/access';
import { commitImport, previewImport } from '@/lib/posh-import';
import { RightsError } from '@/lib/rights';
import { nowIst } from '@/lib/clock';
import { academicYear } from '@/engine/posh';
import type { ImportFile, ImportPlan } from '@/engine/posh-import';

// Server actions for /posh/import. Both resolve the signed-in user HERE and both work the plan out
// from the files on the server: the preview the page shows is never what decides the write.

export type PreviewState =
  | { stage: 'upload'; error?: string }
  | { stage: 'preview'; plan: ImportPlan; files: ImportFile[] };

const MAX_FILES = 40;

function message(err: unknown): string {
  if (err instanceof RightsError) return err.message;
  console.error('[posh import] unexpected failure', err);
  return 'Something went wrong. Nothing was imported.';
}

export async function previewAction(_prev: PreviewState, fd: FormData): Promise<PreviewState> {
  const user = await getCurrentUser();
  const uploads = fd.getAll('files').filter((f): f is File => typeof f === 'object' && f !== null && 'text' in f && f.size > 0);
  if (uploads.length === 0) return { stage: 'upload', error: 'Choose at least one CSV file.' };
  if (uploads.length > MAX_FILES) return { stage: 'upload', error: `Upload at most ${MAX_FILES} files at a time.` };
  try {
    const files = await Promise.all(uploads.map(async (f) => ({ name: f.name.slice(0, 120), text: await f.text() })));
    const plan = await previewImport(user, files, academicYear(nowIst()));
    return { stage: 'preview', plan, files };
  } catch (err) {
    return { stage: 'upload', error: message(err) };
  }
}

function parsePayload(raw: FormDataEntryValue | null): ImportFile[] | null {
  try {
    const v = JSON.parse(String(raw ?? ''));
    if (!Array.isArray(v) || v.length === 0 || v.length > MAX_FILES) return null;
    return v.every((f) => f && typeof f.name === 'string' && typeof f.text === 'string')
      ? v.map((f) => ({ name: String(f.name).slice(0, 120), text: String(f.text) }))
      : null;
  } catch {
    return null;
  }
}

export async function confirmAction(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  const files = parsePayload(fd.get('payload'));
  if (!files) redirect(`/posh/import?${new URLSearchParams({ error: 'The upload was lost. Choose the files again.' })}`);
  let res;
  try {
    res = await commitImport(user, files, academicYear(nowIst()));
  } catch (err) {
    redirect(`/posh/import?${new URLSearchParams({ error: message(err) })}`);
  }
  redirect(
    `/posh/import?${new URLSearchParams({
      created: String(res.created),
      existing: String(res.skippedExisting),
      empty: String(res.skippedEmpty),
      refused: String(res.refused + res.fileErrors),
    })}`,
  );
}
