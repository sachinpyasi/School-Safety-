/**
 * The import's write path (lib/posh-import.ts), Prisma mocked at the @/lib/db seam. What this pins:
 * administrator only, the plan is worked out again on Confirm (never trusted from the page), nothing
 * is ever overwritten, and the trail gets ONE row with counts, never the file's text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { db, audit } = vi.hoisted(() => ({
  db: { poshRecord: { findMany: vi.fn(), createMany: vi.fn() } },
  audit: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/audit', () => ({ audit: (...a: unknown[]) => audit(...a) }));

import { previewImport, commitImport } from '@/lib/posh-import';
import { RightsError } from '@/lib/rights';
import { IMPORT_COLUMNS } from '@/engine/posh-import';

const admin = { email: 'sachin.pyasi@fountainheadschools.org', name: 'Sachin', isRightsAdmin: true };
const editor = { email: 'fsk@fsksurat.in', name: 'FSK', isRightsAdmin: false };

const csv = (...rows: string[][]) => [IMPORT_COLUMNS.join(','), ...rows.map((r) => r.join(','))].join('\n');
const r = (unit: string, total: string, done: string, comment = '', last = '01 Jul 2025') => ['2025', 'POSH', unit, total, done, '', '', '', last, '', comment];
const files = [{ name: 'POSH_2025.csv', text: csv(r('FSK', '10', '5', 'private note'), r('FSM', '20', '20'), r('FWGS', '5', '9'), r('FALH', '', '', '', '')) }];

beforeEach(() => {
  db.poshRecord.findMany.mockReset().mockResolvedValue([{ year: 2025, act: 'POSH', unit: 'FSM' }]);
  db.poshRecord.createMany.mockReset().mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  audit.mockReset();
});

describe('import from old portal', () => {
  it('is administrator only, for the preview and the import, even with an every-unit grant', async () => {
    await expect(previewImport(editor, files, 2026)).rejects.toBeInstanceOf(RightsError);
    await expect(commitImport(editor, files, 2026)).rejects.toThrow(/Only an administrator can import/);
    await expect(commitImport(null, files, 2026)).rejects.toBeInstanceOf(RightsError);
    expect(db.poshRecord.findMany).not.toHaveBeenCalled();
    expect(db.poshRecord.createMany).not.toHaveBeenCalled();
  });

  it('the preview writes nothing', async () => {
    const plan = await previewImport(admin, files, 2026);
    expect(plan.counts).toEqual({ create: 1, existing: 1, empty: 1, refused: 1 });
    expect(db.poshRecord.createMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('creates only the new rows, with skipDuplicates so nothing is ever overwritten', async () => {
    const res = await commitImport(admin, files, 2026);
    expect(db.poshRecord.createMany).toHaveBeenCalledWith({
      data: [{ year: 2025, act: 'POSH', unit: 'FSK', totalEmployees: 10, completed: 5, lastTraining: '2025-07-01', comments: 'private note', updatedBy: admin.email }],
      skipDuplicates: true,
    });
    expect(res).toEqual({ created: 1, skippedExisting: 1, skippedEmpty: 1, refused: 1, fileErrors: 0 });
  });

  it('counts a record saved between the preview and the write as skipped, not overwritten', async () => {
    db.poshRecord.createMany.mockResolvedValue({ count: 0 });
    const res = await commitImport(admin, files, 2026);
    expect(res.created).toBe(0);
    expect(res.skippedExisting).toBe(2);
  });

  it('writes ONE Activity row with counts and codes, never the comments or figures', async () => {
    await commitImport(admin, files, 2026);
    expect(audit).toHaveBeenCalledTimes(1);
    const [actor, action, subject, detail] = audit.mock.calls[0];
    expect(actor).toBe(admin);
    expect(action).toBe('posh.import');
    expect(subject).toBe('1 file');
    expect(detail).toMatchObject({ created: 1, skippedExisting: 1, skippedEmpty: 1, refused: 1, fileErrors: 0, files: 1, years: [2025] });
    expect(detail.sha256).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(detail)).not.toContain('private note');
  });
});
