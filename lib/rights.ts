/**
 * Who may change a POSH / POCSO record, and the screen that decides it.
 *
 * Two doors, and only two:
 *   1. RIGHTS_ADMIN_EMAILS (lib/auth/access.ts): may give and take away grants, may edit every unit,
 *      and may delete a year. Bootstrap, independent of the table it gates, so the first grant can
 *      always be made.
 *   2. An `AppUserRight` row: the grant, for one unit or (unit null) every unit. Its existence IS
 *      the permission. No role column, no implicit tier.
 *
 * Signing in on an org domain never implies either. A colleague with no grant sees the records and
 * cannot change them.
 *
 * NAMING A PERSON: this screen takes a typed school email address. A people picker (search the
 * staff list and choose) needs a copy of the staff directory, which this app does not have yet.
 */
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { isAllowedEmail } from '@/lib/auth/gate';
import type { SignedInUser } from '@/lib/auth/access';
import { canEditUnit, canEditAny, parseGrantUnit, type Grant } from '@/engine/rights';

export class RightsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RightsError';
  }
}

/** The grants a signed-in person holds. Empty for somebody never granted anything. */
export async function grantsOf(user: SignedInUser | null): Promise<Grant[]> {
  if (!user) return [];
  const u = await prisma.appUser.findUnique({
    where: { email: user.email.trim().toLowerCase() },
    select: { rights: { select: { unit: true } } },
  });
  return u?.rights ?? [];
}

/** Refuse unless `user` may edit `unit`. Called by every write, with the unit the WRITE targets. */
export async function assertCanEditUnit(user: SignedInUser | null, unit: string): Promise<SignedInUser> {
  if (!user) throw new RightsError('Please sign in again.');
  if (user.isRightsAdmin) return user;
  if (!canEditUnit(await grantsOf(user), false, unit)) {
    throw new RightsError(`You do not have edit rights for ${unit}. Ask an administrator at /rights.`);
  }
  return user;
}

export async function mayEditAnything(user: SignedInUser | null): Promise<boolean> {
  if (!user) return false;
  return canEditAny(await grantsOf(user), user.isRightsAdmin);
}

export function assertRightsAdmin(user: SignedInUser | null): asserts user is SignedInUser {
  if (!user || !user.isRightsAdmin) {
    throw new RightsError('Only an administrator can do that.');
  }
}

export async function listGrants() {
  return prisma.appUserRight.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, unit: true, grantedBy: true, createdAt: true, user: { select: { email: true, name: true } } },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Give `rawEmail` edit rights for one unit (or every unit). Idempotent: an identical existing
 *  grant is neither re-created nor re-audited (dedupe here, because the schema cannot; see the
 *  AppUserRight comment). The address must be on an org domain: a grant to an outside address could
 *  never be used, since they cannot sign in, and would only ever be a typo. */
export async function grantRight(
  admin: SignedInUser | null,
  rawEmail: string,
  rawName: string,
  rawUnit: string,
): Promise<{ email: string; unit: string | null; created: boolean }> {
  assertRightsAdmin(admin);
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new RightsError('That is not an email address.');
  if (!isAllowedEmail(email)) throw new RightsError('Grants are for Fountainhead school email addresses only.');
  const unit = parseGrantUnit(rawUnit);
  if (unit === undefined) throw new RightsError('Choose a unit, or every unit.');
  const name = rawName.trim().slice(0, 80) || email.split('@')[0];

  const user = await prisma.appUser.upsert({
    where: { email },
    create: { email, name },
    update: {},
    select: { id: true },
  });
  const existing = await prisma.appUserRight.findFirst({ where: { userId: user.id, unit }, select: { id: true } });
  if (existing) return { email, unit, created: false };

  await prisma.appUserRight.create({ data: { userId: user.id, unit, grantedBy: admin.email } });
  await audit(admin, 'right.grant', email, { unit: unit ?? 'ALL' });
  return { email, unit, created: true };
}

/** Take one grant away, by its id. What is audited is read from the ROW, never from the form. */
export async function revokeRight(admin: SignedInUser | null, rightId: string): Promise<void> {
  assertRightsAdmin(admin);
  const row = await prisma.appUserRight.findUnique({
    where: { id: String(rightId) },
    select: { id: true, unit: true, user: { select: { email: true } } },
  });
  if (!row) return; // already gone: a double-click, or two admins at once
  await prisma.appUserRight.delete({ where: { id: row.id } });
  await audit(admin, 'right.revoke', row.user.email, { unit: row.unit ?? 'ALL' });
}
