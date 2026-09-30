/**
 * POSH / POCSO records: the database side. What counts as a valid edit and how a record reads are
 * pure (engine/posh.ts); who may make it is lib/rights.ts. This file only runs the queries.
 */
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import type { SignedInUser } from '@/lib/auth/access';
import { assertCanEditUnit, assertRightsAdmin, RightsError } from '@/lib/rights';
import { parsePoshEdit, yearLabel, type PoshAct, type PoshRecordInput } from '@/engine/posh';

export class PoshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoshError';
  }
}

export async function recordsFor(year: number, act: PoshAct): Promise<(PoshRecordInput & { updatedBy: string; updatedAt: Date })[]> {
  return prisma.poshRecord.findMany({
    where: { year, act },
    select: { unit: true, totalEmployees: true, completed: true, lastTraining: true, comments: true, updatedBy: true, updatedAt: true },
  });
}

/** Years that hold at least one record, newest first. */
export async function yearsWithRecords(): Promise<number[]> {
  const rows = await prisma.poshRecord.findMany({ distinct: ['year'], select: { year: true }, orderBy: { year: 'desc' } });
  return rows.map((r) => r.year);
}

/**
 * Save one unit's record for one Act and year. Upsert on the row's own identity (year, act, unit),
 * so there is nothing to "generate" first, and saving one unit can never touch another.
 *
 * Order matters: the input is PARSED first (so a malformed post is refused before any lookup), then
 * the right is checked against the unit the parsed input names, the unit this write lands on.
 */
export async function saveRecord(user: SignedInUser | null, raw: Record<string, unknown>, currentYear: number) {
  const parsed = parsePoshEdit(raw, currentYear);
  if (!parsed.ok) throw new PoshError(parsed.error);
  const v = parsed.value;
  const actor = await assertCanEditUnit(user, v.unit);

  const data = {
    totalEmployees: v.totalEmployees,
    completed: v.completed,
    lastTraining: v.lastTraining,
    comments: v.comments,
    updatedBy: actor.email,
  };
  await prisma.poshRecord.upsert({
    where: { year_act_unit: { year: v.year, act: v.act, unit: v.unit } },
    create: { year: v.year, act: v.act, unit: v.unit, ...data },
    update: data,
  });
  // Counts and codes only. The note is free text a person typed, so it is not copied into the trail.
  await audit(actor, 'posh.save', `${v.act} ${v.unit} ${yearLabel(v.year)}`, {
    year: v.year,
    act: v.act,
    unit: v.unit,
    total: v.totalEmployees,
    trained: v.completed,
    lastTraining: v.lastTraining,
  });
  return v;
}

/**
 * Delete every record of one academic year, both Acts, every unit. Administrator only, and the
 * caller must have typed the year back: the form's confirm() dialog is a browser convenience that a
 * hand-built POST does not pass through, and this cannot be undone here.
 */
export async function deleteYear(user: SignedInUser | null, rawYear: unknown, rawConfirm: unknown): Promise<number> {
  try {
    assertRightsAdmin(user);
  } catch (e) {
    if (e instanceof RightsError) throw new RightsError('Only an administrator can delete a year.');
    throw e;
  }
  const year = Number(String(rawYear ?? '').trim());
  if (!Number.isInteger(year) || year < 2000 || year > 3000) throw new PoshError('That is not a year.');
  if (String(rawConfirm ?? '').trim() !== String(year)) {
    throw new PoshError(`Type ${year} in the box to confirm. Nothing was deleted.`);
  }
  const removed = await prisma.poshRecord.deleteMany({ where: { year } });
  if (removed.count > 0) await audit(user, 'posh.delete_year', yearLabel(year), { year, rows: removed.count });
  return removed.count;
}
