/**
 * Who may change what, as a pure function of the grants a person holds. lib/rights.ts reads the
 * grants; this decides.
 *
 * The FLAT rights shape (docs/RULES.md §Rights): a
 * grant row's EXISTENCE is the permission. There is no role field and no implicit viewer tier, and
 * `unit: null` means every unit, present and future, never "not yet assigned".
 *
 * The unit is the POSH unit code (six schools + GROUP). The legacy portal gave each person PAGES +
 * SCHOOLS; this prototype has one page, so a grant is just a unit.
 */
import { isUnit } from './posh';

export interface Grant {
  unit: string | null;
}

/** May edit this unit's POSH / POCSO record. A rights administrator (RIGHTS_ADMIN_EMAILS) may edit
 *  every unit: without that the first grant could never be tested by the person who made it. */
export function canEditUnit(grants: readonly Grant[], isRightsAdmin: boolean, unit: string): boolean {
  if (!isUnit(unit)) return false;
  if (isRightsAdmin) return true;
  return grants.some((g) => g.unit === null || g.unit === unit);
}

/** Holds at least one grant, so the page shows the edit controls at all. */
export function canEditAny(grants: readonly Grant[], isRightsAdmin: boolean): boolean {
  return isRightsAdmin || grants.length > 0;
}

/** A submitted grant scope: 'ALL' → every unit (null), a unit code → that unit, anything else →
 *  undefined (refuse). An EMPTY value is refused, never read as "every unit": the widest grant must
 *  be asked for by name, so a form posted without a choice cannot hand it out. */
export function parseGrantUnit(raw: unknown): string | null | undefined {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'ALL') return null;
  return isUnit(s) ? s : undefined;
}
