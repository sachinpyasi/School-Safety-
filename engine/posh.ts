/**
 * POSH / POCSO: annual training compliance, as COUNTS per unit. Pure: no I/O, no clock. A page asks
 * lib/clock.ts for `today` and hands that plain 'YYYY-MM-DD' string in.
 *
 * Ported from the live portal (School-SafetyHQ/apps-script/Code.gs §POSH and Index.html's
 * renderPosh), and deliberately faithful to it. What it does, and the one place this differs from it,
 * is in docs/LEGACY-PAGES.md §6 and the comments below.
 *
 * Why its own table and not SSHQ Checks: PORT-PLAN A4 ("POSH keeps its counts outside SSHQ"). The
 * page shows "118 of 120 trained", a count, and SSHQ's Evidence has no numeric result. So this
 * module is the small POSH-specific table A4 asks for, and it folds into nucleus as that.
 *
 * Every date here is a 'YYYY-MM-DD' STRING and all arithmetic is done on its parts through
 * Date.UTC. Never through a local-time Date: the Nucleus estate recorded the Asia/Calcutta LMT
 * drift shifting real dates a month in this estate.
 */

export const POSH_ACTS = ['POSH', 'POCSO'] as const;
export type PoshAct = (typeof POSH_ACTS)[number];

/** The sheet's own row order. GROUP (Group Operations) is a unit, NOT a school. The legacy portal
 *  never hides it by school scope, and here only an all-units grant or a GROUP grant may edit it. */
export const POSH_UNITS = [
  { code: 'FSK', name: 'FSK' },
  { code: 'FWGS', name: 'FWGS' },
  { code: 'FSM', name: 'FSM' },
  { code: 'FALH', name: 'FALH' },
  { code: 'FPV', name: 'FP Vesu' },
  { code: 'FPA', name: 'FP Adajan' },
  { code: 'GROUP', name: 'Group Operations' },
] as const;
export type PoshUnit = (typeof POSH_UNITS)[number]['code'];

/** Renewal falls due a year after the session; the page warns inside this many days (legacy value). */
export const DUE_SOON_DAYS = 60;

/** The academic year starts in June, as everywhere in the portal. */
export const AY_START_MONTH = 6;

/** A sanity ceiling on a headcount. The largest unit today is in the hundreds. */
export const MAX_HEADCOUNT = 100_000;

export const MAX_COMMENT = 500;

export function isAct(v: unknown): v is PoshAct {
  return typeof v === 'string' && (POSH_ACTS as readonly string[]).includes(v);
}

export function isUnit(v: unknown): v is PoshUnit {
  return typeof v === 'string' && POSH_UNITS.some((u) => u.code === v);
}

export function unitName(code: string): string {
  return POSH_UNITS.find((u) => u.code === code)?.name ?? code;
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date in 'YYYY-MM-DD' form ('2026-02-30' is not). */
export function isIsoDay(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = DAY_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** The academic year a day falls in, named by its starting calendar year: 2026-09-26 → 2026, and
 *  2027-03-01 → 2026 (June–May). */
export function academicYear(today: string): number {
  const [y, m] = today.split('-').map(Number);
  return m >= AY_START_MONTH ? y : y - 1;
}

/** 2026 → '2026–27'. */
export function yearLabel(year: number): string {
  return `${year}–${String((year + 1) % 100).padStart(2, '0')}`;
}

/** `?year=` → a year, or the current academic year for anything that is not a plausible one. */
export function parseYear(raw: unknown, current: number): number {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}$/.test(s)) return current;
  const y = Number(s);
  return y >= 2015 && y <= current + 1 ? y : current;
}

/** `?act=` → an Act, POSH when absent or unknown. */
export function parseAct(raw: unknown): PoshAct {
  return isAct(raw) ? raw : 'POSH';
}

/** The day renewal falls due: the same date a year after the session. 29-Feb falls due on 28-Feb. */
export function dueDate(lastTraining: string | null): string | null {
  if (!lastTraining || !isIsoDay(lastTraining)) return null;
  const [y, m, d] = lastTraining.split('-').map(Number);
  const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate(); // days in month m of year y+1
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

/** One unit's record for one Act in one year, as stored. `null` means "not entered yet", which is
 *  different from 0: the legacy sheet kept the two apart and so does this. */
export interface PoshRecordInput {
  unit: string;
  totalEmployees: number | null;
  completed: number | null;
  lastTraining: string | null;
  comments: string | null;
}

export type BandKey = 'none' | 'expired' | 'urgent' | 'open' | 'soon' | 'ok';

export interface PoshBand {
  key: BandKey;
  label: string;
}

export interface PoshCard {
  unit: string;
  name: string;
  total: number | null;
  completed: number | null;
  pending: number | null;
  /** Whole per cent trained, or null when there is no headcount to divide by. */
  pct: number | null;
  lastTraining: string | null;
  due: string | null;
  /** Days until renewal is due (negative = overdue), or null with no session date. */
  daysLeft: number | null;
  band: PoshBand;
  comments: string | null;
}

/**
 * The status word, DERIVED and never stored: the legacy portal's poshBand_, rule for rule.
 *   no headcount            → not started
 *   past its renewal date   → overdue            (whatever the count says)
 *   people still to train   → "pending & due soon" inside DUE_SOON_DAYS, else "N pending"
 *   everyone trained        → "renewal near" inside DUE_SOON_DAYS, else complete
 */
export function band(total: number | null, completed: number | null, daysLeft: number | null): PoshBand {
  if (!total) return { key: 'none', label: 'not started' };
  if (daysLeft !== null && daysLeft < 0) return { key: 'expired', label: 'overdue' };
  const done = completed ?? 0;
  const pending = Math.max(0, total - done);
  const soon = daysLeft !== null && daysLeft < DUE_SOON_DAYS;
  if (pending > 0) return soon ? { key: 'urgent', label: 'pending & due soon' } : { key: 'open', label: `${pending} pending` };
  return soon ? { key: 'soon', label: 'renewal near' } : { key: 'ok', label: 'complete' };
}

export function toCard(r: PoshRecordInput, today: string): PoshCard {
  const total = r.totalEmployees;
  const completed = r.completed;
  const due = dueDate(r.lastTraining);
  const daysLeft = due ? daysBetween(today, due) : null;
  return {
    unit: r.unit,
    name: unitName(r.unit),
    total,
    completed,
    pending: total ? Math.max(0, total - (completed ?? 0)) : null,
    pct: total ? Math.round((100 * (completed ?? 0)) / total) : null,
    lastTraining: r.lastTraining,
    due,
    daysLeft,
    band: band(total, completed, daysLeft),
    comments: r.comments,
  };
}

/** Every unit, in the sheet's order, for one Act in one year. A unit with no stored row yet is a
 *  blank card, so the grid is always complete. Nothing needs "generating" before it can be filled
 *  in, and nothing that exists is ever overwritten by showing it. */
export function buildCards(rows: readonly PoshRecordInput[], today: string): PoshCard[] {
  return POSH_UNITS.map((u) => {
    const r = rows.find((x) => x.unit === u.code);
    return toCard(r ?? { unit: u.code, totalEmployees: null, completed: null, lastTraining: null, comments: null }, today);
  });
}

export interface PoshSummary {
  employees: number;
  trained: number;
  pending: number;
  /** Whole per cent across every unit with a headcount, or null when none has one. */
  overallPct: number | null;
  unitsComplete: number;
  unitsPending: number;
  unitsNotStarted: number;
}

/** The six figures the sheet defines above its own table, plus "not started" so all seven units are
 *  accounted for. */
export function summarise(cards: readonly PoshCard[]): PoshSummary {
  let employees = 0;
  let trained = 0;
  let unitsComplete = 0;
  let unitsPending = 0;
  let unitsNotStarted = 0;
  for (const c of cards) {
    if (!c.total) {
      unitsNotStarted++;
      continue;
    }
    employees += c.total;
    trained += Math.min(c.completed ?? 0, c.total);
    if (c.pending) unitsPending++;
    else unitsComplete++;
  }
  return {
    employees,
    trained,
    pending: employees - trained,
    overallPct: employees ? Math.round((100 * trained) / employees) : null,
    unitsComplete,
    unitsPending,
    unitsNotStarted,
  };
}

export interface PoshEdit {
  year: number;
  act: PoshAct;
  unit: PoshUnit;
  totalEmployees: number | null;
  completed: number | null;
  lastTraining: string | null;
  comments: string | null;
}

export type PoshEditResult = { ok: true; value: PoshEdit } | { ok: false; error: string };

function count(raw: unknown, label: string): { ok: true; n: number | null } | { ok: false; error: string } {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: true, n: null };
  if (!/^\d+$/.test(s)) return { ok: false, error: `${label} must be a whole number.` };
  const n = Number(s);
  if (n > MAX_HEADCOUNT) return { ok: false, error: `${label} looks too large (${n}).` };
  return { ok: true, n };
}

/**
 * A submitted edit → a value that is safe to store, or the sentence to show. The server's last word:
 * the page's own `min`/`max` attributes are a convenience a hand-built POST does not have to honour.
 *
 * ONE DELIBERATE DIFFERENCE FROM THE PORTAL: legacy savePoshField silently CLAMPED "trained" down to
 * the headcount. Here the edit is REFUSED with the reason. A number that changes after you typed it
 * is a number you did not enter, and on a compliance record that is worse than an error message.
 */
export function parsePoshEdit(raw: Record<string, unknown>, currentYear: number): PoshEditResult {
  const yearStr = String(raw.year ?? '').trim();
  if (!/^\d{4}$/.test(yearStr)) return { ok: false, error: 'That is not a year.' };
  const year = Number(yearStr);
  if (year < 2015 || year > currentYear + 1) return { ok: false, error: `${yearStr} is outside the years this page keeps.` };
  if (!isAct(raw.act)) return { ok: false, error: 'Choose POSH or POCSO.' };
  if (!isUnit(raw.unit)) return { ok: false, error: 'That is not one of the seven units.' };

  const total = count(raw.totalEmployees, 'Total employees');
  if (!total.ok) return total;
  const completed = count(raw.completed, 'Trained');
  if (!completed.ok) return completed;
  if (completed.n !== null && total.n === null) {
    return { ok: false, error: 'Set the total number of employees before the number trained.' };
  }
  if (completed.n !== null && total.n !== null && completed.n > total.n) {
    return { ok: false, error: `Trained (${completed.n}) cannot be more than the total employees (${total.n}).` };
  }

  const lastStr = String(raw.lastTraining ?? '').trim();
  if (lastStr !== '' && !isIsoDay(lastStr)) return { ok: false, error: 'The last training date is not a real date.' };

  const comments = String(raw.comments ?? '').trim();
  if (comments.length > MAX_COMMENT) return { ok: false, error: `Keep the note under ${MAX_COMMENT} characters.` };

  return {
    ok: true,
    value: {
      year,
      act: raw.act,
      unit: raw.unit,
      totalEmployees: total.n,
      completed: completed.n,
      lastTraining: lastStr || null,
      comments: comments || null,
    },
  };
}

/** Header + rows for the CSV download, the legacy export's columns in its order. Dates in the
 *  estate's DD-MMM-YYYY. */
export function csvRows(year: number, act: PoshAct, cards: readonly PoshCard[]): string[][] {
  const head = ['Year', 'Act', 'Unit', 'Total employees', 'Completed', 'Pending', '% completed', 'Status', 'Last training', 'Next due', 'Comments'];
  return [
    head,
    ...cards.map((c) => [
      yearLabel(year),
      act,
      c.name,
      c.total === null ? '' : String(c.total),
      c.completed === null ? '' : String(c.completed),
      c.pending === null ? '' : String(c.pending),
      c.pct === null ? '' : `${c.pct}%`,
      c.band.label,
      c.lastTraining ? dayLabel(c.lastTraining) : '',
      c.due ? dayLabel(c.due) : '',
      c.comments ?? '',
    ]),
  ];
}

/** RFC 4180: every field quoted, quotes doubled, CRLF between rows. A leading =, +, - or @ is
 *  prefixed with an apostrophe so a note typed as "=HYPERLINK(...)" is text in a spreadsheet, not a
 *  formula (CSV injection). */
export function toCsv(rows: readonly string[][]): string {
  const q = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return rows.map((r) => r.map(q).join(',')).join('\r\n');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-08-03' → '03-Aug-2026', from the string (estate display rule). */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}
