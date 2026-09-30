'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/access';
import { saveRecord, deleteYear, PoshError } from '@/lib/posh';
import { RightsError } from '@/lib/rights';
import { nowIst } from '@/lib/clock';
import { academicYear, isAct, unitName } from '@/engine/posh';

// Server actions for /posh. Every one resolves the signed-in user HERE (every export of a
// 'use server' module is a public endpoint), so the form can claim nothing about who is submitting
// it. Outcomes travel back as a query string so the page stays a plain server component.
function back(params: Record<string, string>): never {
  redirect(`/posh?${new URLSearchParams(params).toString()}`);
}

function message(err: unknown): string {
  if (err instanceof PoshError || err instanceof RightsError) return err.message;
  console.error('[posh] unexpected failure', err);
  return 'Something went wrong. Nothing was changed.';
}

function form(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ['year', 'act', 'unit', 'totalEmployees', 'completed', 'lastTraining', 'comments']) {
    out[k] = String(fd.get(k) ?? '');
  }
  return out;
}

export async function saveAction(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  const raw = form(fd);
  // Where to land afterwards: the same year and Act, echoed only once they are known-good values.
  const stay = { year: /^\d{4}$/.test(raw.year) ? raw.year : '', act: isAct(raw.act) ? raw.act : '' };
  let saved;
  try {
    saved = await saveRecord(user, raw, academicYear(nowIst()));
  } catch (err) {
    back({ ...stay, error: message(err), open: raw.unit });
  }
  back({ ...stay, ok: `${unitName(saved.unit)} · ${saved.act} saved.` });
}

export async function deleteYearAction(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  const year = String(fd.get('year') ?? '');
  let n;
  try {
    n = await deleteYear(user, year, fd.get('confirm'));
  } catch (err) {
    back({ year, error: message(err) });
  }
  back({ ok: n ? `Deleted ${year}: ${n} record${n === 1 ? '' : 's'}.` : `${year} had no records to delete.` });
}
