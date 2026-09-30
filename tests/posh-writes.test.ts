/**
 * The write paths: lib/posh.ts (save a record, delete a year) and lib/rights.ts (grant, revoke).
 * Prisma is mocked at the @/lib/db seam and the audit helper at its own; the org-domain check runs
 * for real against the seed list. What these pin is ORDER and SCOPE: who is refused before anything
 * is read, which unit the right is checked against, and that nothing is written on a refusal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted: vi.mock factories run before the module body, so the mocks must exist by then.
const { db, audit } = vi.hoisted(() => ({
  db: {
    appUser: { findUnique: vi.fn(), upsert: vi.fn() },
    appUserRight: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    poshRecord: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
  audit: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/audit', () => ({ audit: (...a: unknown[]) => audit(...a) }));

import { saveRecord, deleteYear, PoshError } from '@/lib/posh';
import { grantRight, revokeRight, RightsError } from '@/lib/rights';

const admin = { email: 'sachin.pyasi@fountainheadschools.org', name: 'Sachin', isRightsAdmin: true };
const fskEditor = { email: 'fsk.coordinator@fsksurat.in', name: 'FSK', isRightsAdmin: false };
const colleague = { email: 'teacher@fwgs.in', name: 'T', isRightsAdmin: false };

const edit = { year: '2026', act: 'POSH', unit: 'FSK', totalEmployees: '120', completed: '118', lastTraining: '2026-07-01', comments: 'booked' };

function grants(...units: (string | null)[]) {
  db.appUser.findUnique.mockResolvedValue({ rights: units.map((unit) => ({ unit })) });
}

beforeEach(() => {
  for (const t of Object.values(db)) for (const f of Object.values(t)) f.mockReset();
  audit.mockReset();
  db.poshRecord.upsert.mockResolvedValue({});
  db.appUser.findUnique.mockResolvedValue(null);
});

describe('saveRecord', () => {
  it('saves an edit for a unit the person holds, upserting on (year, act, unit) and auditing counts only', async () => {
    grants('FSK');
    await saveRecord(fskEditor, edit, 2026);
    expect(db.poshRecord.upsert).toHaveBeenCalledWith({
      where: { year_act_unit: { year: 2026, act: 'POSH', unit: 'FSK' } },
      create: { year: 2026, act: 'POSH', unit: 'FSK', totalEmployees: 120, completed: 118, lastTraining: '2026-07-01', comments: 'booked', updatedBy: fskEditor.email },
      update: { totalEmployees: 120, completed: 118, lastTraining: '2026-07-01', comments: 'booked', updatedBy: fskEditor.email },
    });
    const [actor, action, subject, detail] = audit.mock.calls[0];
    expect(actor).toBe(fskEditor);
    expect(action).toBe('posh.save');
    expect(subject).toBe('POSH FSK 2026–27');
    expect(detail).toEqual({ year: 2026, act: 'POSH', unit: 'FSK', total: 120, trained: 118, lastTraining: '2026-07-01' });
    expect(JSON.stringify(detail)).not.toContain('booked'); // the free-text note stays out of the trail
  });

  it('refuses a unit the person does NOT hold, and writes nothing', async () => {
    grants('FSK');
    await expect(saveRecord(fskEditor, { ...edit, unit: 'FSM' }, 2026)).rejects.toBeInstanceOf(RightsError);
    expect(db.poshRecord.upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('refuses somebody signed in with no grant at all: signing in is not a right', async () => {
    await expect(saveRecord(colleague, edit, 2026)).rejects.toThrow(/do not have edit rights for FSK/);
    await expect(saveRecord(null, edit, 2026)).rejects.toBeInstanceOf(RightsError);
    expect(db.poshRecord.upsert).not.toHaveBeenCalled();
  });

  it('lets an every-unit grant and an administrator edit GROUP', async () => {
    grants(null);
    await saveRecord(fskEditor, { ...edit, unit: 'GROUP' }, 2026);
    await saveRecord(admin, { ...edit, unit: 'GROUP' }, 2026);
    expect(db.poshRecord.upsert).toHaveBeenCalledTimes(2);
  });

  it('refuses a malformed edit BEFORE looking the person up', async () => {
    await expect(saveRecord(fskEditor, { ...edit, completed: '121' }, 2026)).rejects.toBeInstanceOf(PoshError);
    await expect(saveRecord(fskEditor, { ...edit, unit: 'NOPE' }, 2026)).rejects.toBeInstanceOf(PoshError);
    expect(db.appUser.findUnique).not.toHaveBeenCalled();
    expect(db.poshRecord.upsert).not.toHaveBeenCalled();
  });
});

describe('deleteYear', () => {
  it('is administrator only, even for a person with an every-unit grant', async () => {
    grants(null);
    await expect(deleteYear(fskEditor, '2026', '2026')).rejects.toThrow(/Only an administrator can delete a year/);
    expect(db.poshRecord.deleteMany).not.toHaveBeenCalled();
  });

  it('needs the year typed back, so a hand-built post that skips the dialog deletes nothing', async () => {
    await expect(deleteYear(admin, '2026', '')).rejects.toBeInstanceOf(PoshError);
    await expect(deleteYear(admin, '2026', '2025')).rejects.toBeInstanceOf(PoshError);
    await expect(deleteYear(admin, 'all', 'all')).rejects.toBeInstanceOf(PoshError);
    expect(db.poshRecord.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes exactly that year, and audits the count', async () => {
    db.poshRecord.deleteMany.mockResolvedValue({ count: 14 });
    expect(await deleteYear(admin, '2026', ' 2026 ')).toBe(14);
    expect(db.poshRecord.deleteMany).toHaveBeenCalledWith({ where: { year: 2026 } });
    expect(audit).toHaveBeenCalledWith(admin, 'posh.delete_year', '2026–27', { year: 2026, rows: 14 });
  });
});

describe('grantRight / revokeRight', () => {
  beforeEach(() => {
    db.appUser.upsert.mockResolvedValue({ id: 'u1' });
    db.appUserRight.create.mockResolvedValue({});
  });

  it('refuses a non-administrator before any lookup', async () => {
    await expect(grantRight(fskEditor, 'a@fsksurat.in', 'A', 'FSK')).rejects.toBeInstanceOf(RightsError);
    expect(db.appUser.upsert).not.toHaveBeenCalled();
  });

  it('refuses an outside address, a non-address and an unchosen unit', async () => {
    await expect(grantRight(admin, 'someone@gmail.com', 'S', 'FSK')).rejects.toThrow(/Fountainhead school email/);
    await expect(grantRight(admin, 'nope', 'S', 'FSK')).rejects.toThrow(/not an email/);
    await expect(grantRight(admin, 'a@fsksurat.in', 'A', '')).rejects.toThrow(/Choose a unit/);
    expect(db.appUserRight.create).not.toHaveBeenCalled();
  });

  it('creates the grant lower-cased and audits who granted what to whom', async () => {
    db.appUserRight.findFirst.mockResolvedValue(null);
    const res = await grantRight(admin, ' A.Person@FSKSurat.in ', ' A Person ', 'fsk');
    expect(res).toEqual({ email: 'a.person@fsksurat.in', unit: 'FSK', created: true });
    expect(db.appUser.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'a.person@fsksurat.in' }, create: { email: 'a.person@fsksurat.in', name: 'A Person' } }));
    expect(db.appUserRight.create).toHaveBeenCalledWith({ data: { userId: 'u1', unit: 'FSK', grantedBy: admin.email } });
    expect(audit).toHaveBeenCalledWith(admin, 'right.grant', 'a.person@fsksurat.in', { unit: 'FSK' });
  });

  it('is idempotent, the every-unit grant included (the schema cannot dedupe NULL)', async () => {
    db.appUserRight.findFirst.mockResolvedValue({ id: 'r1' });
    const res = await grantRight(admin, 'a@fsksurat.in', 'A', 'ALL');
    expect(db.appUserRight.findFirst).toHaveBeenCalledWith({ where: { userId: 'u1', unit: null }, select: { id: true } });
    expect(res.created).toBe(false);
    expect(db.appUserRight.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('revokes by id and audits what the ROW said, not what the form said', async () => {
    db.appUserRight.findUnique.mockResolvedValue({ id: 'r1', unit: null, user: { email: 'a@fsksurat.in' } });
    await revokeRight(admin, 'r1');
    expect(db.appUserRight.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(audit).toHaveBeenCalledWith(admin, 'right.revoke', 'a@fsksurat.in', { unit: 'ALL' });
  });

  it('treats a grant that is already gone as done, and a non-admin revoke as refused', async () => {
    db.appUserRight.findUnique.mockResolvedValue(null);
    await revokeRight(admin, 'gone');
    expect(db.appUserRight.delete).not.toHaveBeenCalled();
    await expect(revokeRight(fskEditor, 'r1')).rejects.toBeInstanceOf(RightsError);
  });
});
