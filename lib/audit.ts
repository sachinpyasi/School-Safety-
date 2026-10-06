/**
 * The audit trail.
 *
 * The estate rule: **a row names the real signed-in person, never a bare capability.** A log exists
 * to answer "who did this"; one that records "editor" instead of a person's address cannot.
 *
 * `detail` carries counts and codes (year, Act, unit, the figures entered) and the email a grant was
 * about. Nothing else about a person.
 *
 * Writes here must never break the action they record — an audit failure is worth a server log,
 * not a failed save. Hence the swallowed catch.
 */
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export type AuditAction =
  /** "Who signed in" — one row per person per SIGN_IN_WINDOW_MS (engine/activity.ts), written by
   *  lib/auth/presence.ts straight to Prisma so a test can pin the clock. */
  | 'sign_in'
  /** One unit's POSH / POCSO record was saved (created or changed). */
  | 'posh.save'
  /** Records copied from the old portal's CSV files. Admin only. One row per import, with counts. */
  | 'posh.import'
  /** A whole academic year of POSH / POCSO records was deleted. Admin only. */
  | 'posh.delete_year'
  /** A grant to edit a unit (or every unit) was given / taken away. */
  | 'right.grant'
  | 'right.revoke';

export async function audit(
  actor: { email: string; name: string },
  action: AuditAction,
  subject?: string,
  detail?: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorEmail: actor.email.trim().toLowerCase(),
        actorName: actor.name,
        action,
        subject: subject ?? null,
        detail: detail ?? undefined,
      },
    });
  } catch (err) {
    console.error('[audit] failed to record', action, err);
  }
}
