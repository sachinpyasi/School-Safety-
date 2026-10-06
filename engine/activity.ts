/**
 * Pure scope + labelling for the Activity register (docs/decisions/ACTIVITY-SCREEN-RULINGS-2026-09-04.md
 * and REGISTER-SPEC.md). No I/O here — lib/activity.ts runs the queries; this file decides what a
 * URL's filters mean, how a row reads, and how sign-ins bucket into the presence strip.
 *
 * Copied from the Nucleus prototypes estate (30-Sep-2026) with this app's own, much smaller action
 * vocabulary. Built with the app's first mutation, per docs/RULES.md §Activity: an app
 * that records a trail lets a human read it from day one.
 */
import { fromIst, istParts, fmtDate, fmtTime } from './ist';
import type { AuditAction } from '@/lib/audit';

const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** Action keys here are dot-namespaced (`posh.save`) except the estate's bare `sign_in`. */
const ACTION_RE = /^[a-z][a-z0-9_.]{0,63}$/;

export interface ActivityScopeInput {
  from?: string;
  to?: string;
  actor?: string;
  action?: string;
  /** `?signins=1` — puts sign-in rows back among the decisions (register spec §2). */
  signins?: string;
}

export interface ActivityScope {
  /** IST calendar days, inclusive — 'YYYY-MM-DD'. */
  from: string;
  to: string;
  /** Case-insensitive substring of the actor email, or null for everyone. */
  actor: string | null;
  /** One audit action key, or null for all. */
  action: string | null;
  /** True only when `enforceSelfView` set `actor` to the viewer's own email — an exact match is a
   *  security boundary there, not a search convenience. */
  actorExact: boolean;
  withSignIns: boolean;
}

export function resolveActivityScope(raw: ActivityScopeInput, today: string): ActivityScope {
  const from = DAY_RE.test(raw.from ?? '') ? raw.from! : today;
  const to = DAY_RE.test(raw.to ?? '') ? raw.to! : today;
  const [lo, hi] = from <= to ? [from, to] : [to, from]; // 'YYYY-MM-DD' sorts chronologically
  const actor = (raw.actor ?? '').trim().toLowerCase().slice(0, 120) || null;
  const action = ACTION_RE.test(raw.action ?? '') ? raw.action! : null;
  const withSignIns = raw.signins === '1';
  return { from: lo, to: hi, actor, action, actorExact: false, withSignIns };
}

/**
 * Ruling 3: the rights administrators see everyone; every other signed-in person sees only their
 * own sign-ins and actions. Applied AFTER `resolveActivityScope`, so a crafted `?actor=someone-else`
 * from a non-admin is unconditionally OVERWRITTEN with the viewer's own identity. `actorExact: true`
 * makes lib/activity.ts match EXACTLY, not as a substring — `j.patel@…` must not see `raj.patel@…`.
 */
export function enforceSelfView(scope: ActivityScope, canSeeEveryone: boolean, viewerEmail: string): ActivityScope {
  if (canSeeEveryone) return scope;
  return { ...scope, actor: viewerEmail.trim().toLowerCase(), actorExact: true };
}

const DAY_MS = 86_400_000;

/** IST calendar days → the UTC instant range [gte, lt). */
export function istDayRange(from: string, to: string): { gte: Date; lt: Date } {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return { gte: fromIst(fy, fm, fd), lt: fromIst(ty, tm, td + 1) };
}

/** ISO day n days before `today`, on the IST calendar. */
export function daysBefore(today: string, n: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const p = istParts(fromIst(y, m, d - n));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** IST calendar days spanned by [from, to], inclusive (1 for a single day). */
export function daysSpanned(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const ms = fromIst(ty, tm, td).getTime() - fromIst(fy, fm, fd).getTime();
  return Math.round(ms / DAY_MS) + 1;
}

/** The sign-in action key — the estate's usual bare `sign_in`. */
export const SIGN_IN_ACTION: AuditAction = 'sign_in';

/** Ruling 4: a machine RUN writes one summary row. This app has no machine runs — nothing here
 *  happens without a person pressing something — so the list is empty, kept so the read model
 *  (lib/activity.ts) has the same shape as every sibling's and grows a scheduled job without a
 *  re-plumb. */
export const MACHINE_ACTIONS: readonly AuditAction[] = [];

/** One `sign_in` row per person per this window. "How many PEOPLE used the app today", not a
 *  heartbeat: every page view resolves the user, and without the throttle the trail would be
 *  nothing but sign-ins. */
export const SIGN_IN_WINDOW_MS = 8 * 60 * 60 * 1000;

/** The working day, in IST hours — a sign-in outside it is marked on the presence strip. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 21;

/** The presence strip's data (register spec §1). Field names are FIXED across every app. */
export interface ActivityPresence {
  /** Sign-in rows per IST hour, index 0..23. Always length 24. */
  hours: number[];
  total: number;
  people: number;
  outOfHours: number;
  days: number;
}

export function buildPresence(times: readonly Date[], people: number, days: number): ActivityPresence {
  const hours = new Array(24).fill(0);
  let outOfHours = 0;
  for (const at of times) {
    const h = istParts(at).hour;
    hours[h]++;
    if (h < DAY_START_HOUR || h >= DAY_END_HOUR) outOfHours++;
  }
  return { hours, total: hours.reduce((a, b) => a + b, 0), people, outOfHours, days };
}

const ACTION_SHORT: Record<string, string> = {
  'posh.save': 'save',
  'posh.import': 'import',
  'posh.delete_year': 'delete year',
  'right.grant': 'grant',
  'right.revoke': 'revoke',
  sign_in: 'sign in',
};

const ACTION_LABEL: Record<string, string> = {
  'posh.save': 'Saved a POSH / POCSO record',
  'posh.import': 'Imported POSH / POCSO records from the old portal',
  'posh.delete_year': 'Deleted a whole POSH / POCSO year',
  'right.grant': 'Gave someone edit rights',
  'right.revoke': 'Took away edit rights',
  sign_in: 'Signed in',
};

export function actionLabel(key: string): string {
  return ACTION_LABEL[key] ?? key.replace(/[._]/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function actionShort(key: string): string {
  return ACTION_SHORT[key] ?? actionLabel(key);
}

/** Register spec §2's action-class vocabulary — FIXED across every app, never extended locally. */
export type ActionClass = 'money' | 'pii' | 'access' | 'destructive' | 'write' | 'sign' | 'machine';

/**
 * Action key → class, EXHAUSTIVE over `AuditAction` so the compiler refuses a build the day a new
 * key is added without a class. "Louder wins" (spec §2): deleting a year throws away every unit's
 * record for both Acts and cannot be undone here: destructive. `right.*` decide who may change the
 * compliance record: access.
 */
const ACTION_CLASS: Record<AuditAction, ActionClass> = {
  'posh.save': 'write',
  'posh.import': 'write',
  'posh.delete_year': 'destructive',
  'right.grant': 'access',
  'right.revoke': 'access',
  sign_in: 'sign',
};

/** Accepts a raw string (a row read back is a `string`), degrading an unknown key to `'write'`. */
export function actionClass(key: string): ActionClass {
  return (ACTION_CLASS as Record<string, ActionClass>)[key] ?? 'write';
}

/** The register's dense Time column (spec §2): `HH:MM` for a single-day range, `DD-MMM HH:MM`
 *  across days — the year is already in the page header. */
export function registerTimeLabel(at: Date, singleDay: boolean): string {
  if (singleDay) return fmtTime(at);
  return `${fmtDate(at).replace(/-\d{4}$/, '')} ${fmtTime(at)}`;
}

export function atLabel(at: Date): string {
  return `${fmtDate(at)} ${fmtTime(at)}`;
}

/** The JSON `detail` column as one short readable line — `key: value` pairs, primitives only. */
export function summariseDetail(detail: unknown, max = 110, omit: readonly string[] = []): string {
  if (detail === null || detail === undefined) return '';
  let text: string;
  if (typeof detail === 'object' && !Array.isArray(detail)) {
    text = Object.entries(detail as Record<string, unknown>)
      .filter(([k]) => !omit.includes(k))
      .map(([k, val]) => {
        if (val === null || val === undefined) return `${k}: —`;
        if (Array.isArray(val)) return `${k}: [${val.length}]`;
        if (typeof val === 'object') return `${k}: {…}`;
        return `${k}: ${String(val)}`;
      })
      .join(' · ');
  } else {
    text = String(detail);
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
