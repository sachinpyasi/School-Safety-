/**
 * The one place this app reads the real wall clock for "what day is it". Kept out of `engine/`
 * deliberately — every engine function is pure and deterministic given its inputs, and "the actual
 * current instant" is neither; a page asks this file for `today`, then hands that plain string into
 * the pure functions (engine/activity.ts's `resolveActivityScope`, `daysBefore`, …) that do the
 * real work. Mirrors cafeteria-checkin's `lib/clock.ts`.
 */
import { istParts } from '@/engine/ist';

/** Today's IST calendar day, 'YYYY-MM-DD'. */
export function nowIst(now: Date = new Date()): string {
  const p = istParts(now);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
