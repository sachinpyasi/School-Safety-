/**
 * Presence — "who signed in". Every request that resolves a signed-in user (`getCurrentUser`) notes
 * their presence here, throttled to ONE `sign_in` row per person per SIGN_IN_WINDOW_MS
 * (engine/activity.ts). Not a heartbeat: the presence strip asks "how many PEOPLE used the app
 * today", and for a START PAGE opened on every new tab an unthrottled trail would be nothing else.
 *
 * Written straight to Prisma rather than through lib/audit.ts's `audit()`: the row's `at` has to
 * come from an injectable clock so a test can pin it.
 */
import { prisma } from '@/lib/db';
import type { AuditAction } from '@/lib/audit';
import { SIGN_IN_ACTION, SIGN_IN_WINDOW_MS } from '@/engine/activity';

const SIGN_IN_AUDIT_ACTION = SIGN_IN_ACTION satisfies AuditAction;

/** Returns true when a new `sign_in` row was written, false when one already covers this window. */
export async function notePresence(email: string, name: string, now: Date = new Date()): Promise<boolean> {
  const actorEmail = email.trim().toLowerCase();
  if (!actorEmail) return false;

  const recent = await prisma.auditEvent.findFirst({
    where: {
      actorEmail,
      action: SIGN_IN_AUDIT_ACTION,
      at: { gt: new Date(now.getTime() - SIGN_IN_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recent) return false;

  // Two truly simultaneous first requests can both miss the read above and write two rows — a
  // harmless duplicate a distinct-actor count still reports correctly.
  await prisma.auditEvent.create({
    data: {
      actorEmail,
      actorName: name.trim() || actorEmail,
      action: SIGN_IN_AUDIT_ACTION,
      subject: null,
      detail: undefined,
      at: now,
    },
  });
  return true;
}

/** Fail-soft: presence is bookkeeping, and bookkeeping must never turn a sign-in into an error. */
export async function notePresenceSafely(email: string, name: string): Promise<void> {
  try {
    await notePresence(email, name);
  } catch (e) {
    console.error('[presence] sign-in not recorded:', e instanceof Error ? e.message : e);
  }
}
