/**
 * "Import from old portal": the database side. What each row means is pure (engine/posh-import.ts);
 * this file checks who is asking, reads what already exists, and writes.
 *
 * Two calls, and the server decides both from the FILE, never from the page:
 *   previewImport — what WOULD happen. Writes nothing.
 *   commitImport  — works the plan out again from the same files (the preview is never trusted: a
 *                   record may have been saved since), then creates only the "create" rows.
 * Never overwrites: createMany with skipDuplicates, so even a record saved between the plan and the
 * write is left alone and counted as skipped.
 */
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import type { SignedInUser } from '@/lib/auth/access';
import { assertRightsAdmin, RightsError } from '@/lib/rights';
import { keyOf, planImport, type ImportFile, type ImportPlan, type ImportRecord } from '@/engine/posh-import';

function adminOnly(user: SignedInUser | null): asserts user is SignedInUser {
  try {
    assertRightsAdmin(user);
  } catch (e) {
    if (e instanceof RightsError) throw new RightsError('Only an administrator can import from the old portal.');
    throw e;
  }
}

async function existingKeys(): Promise<Set<string>> {
  const rows = await prisma.poshRecord.findMany({ select: { year: true, act: true, unit: true } });
  return new Set(rows.map(keyOf));
}

/** A short fingerprint of exactly what was uploaded, so the trail can say which files were imported
 *  without storing them. */
export function fingerprint(files: readonly ImportFile[]): string {
  const h = createHash('sha256');
  for (const f of files) h.update(f.name).update('\0').update(f.text).update('\0');
  return h.digest('hex').slice(0, 16);
}

export async function previewImport(user: SignedInUser | null, files: readonly ImportFile[], currentYear: number): Promise<ImportPlan> {
  adminOnly(user);
  return planImport(files, await existingKeys(), currentYear);
}

export interface ImportResult {
  created: number;
  /** Already here when the plan was made, or saved by someone between the plan and the write. */
  skippedExisting: number;
  skippedEmpty: number;
  refused: number;
  fileErrors: number;
}

export async function commitImport(user: SignedInUser | null, files: readonly ImportFile[], currentYear: number): Promise<ImportResult> {
  adminOnly(user);
  const plan = planImport(files, await existingKeys(), currentYear);
  const toCreate: ImportRecord[] = plan.rows.flatMap((r) => (r.outcome.kind === 'create' ? [r.outcome.record] : []));

  let created = 0;
  if (toCreate.length > 0) {
    const res = await prisma.poshRecord.createMany({
      data: toCreate.map((r) => ({ ...r, updatedBy: user.email })),
      skipDuplicates: true,
    });
    created = res.count;
  }
  const result: ImportResult = {
    created,
    skippedExisting: plan.counts.existing + (toCreate.length - created),
    skippedEmpty: plan.counts.empty,
    refused: plan.counts.refused,
    fileErrors: plan.fileErrors.length,
  };
  // One row per import, counts and codes only: no comment text, no figures from the file.
  const years = [...new Set(toCreate.map((r) => r.year))].sort();
  await audit(user, 'posh.import', `${files.length} file${files.length === 1 ? '' : 's'}`, {
    ...result,
    files: files.length,
    years,
    sha256: fingerprint(files),
  });
  return result;
}
