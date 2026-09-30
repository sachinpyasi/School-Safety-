/**
 * Time, in Indian Standard Time, done by hand.
 *
 * Everything a user types or reads in this app is IST; everything stored is UTC. That conversion is
 * the whole of this file, and it uses a HARDCODED +05:30 rather than `Intl` / `toLocaleString` with
 * a `timeZone` — on purpose:
 *
 *   - India has been a fixed UTC+05:30 since 1955 and observes no DST, so a constant offset is not
 *     an approximation here; it is exactly right for every date this app will ever handle.
 *   - The Nucleus estate recorded a standing warning about the Asia/Calcutta LMT drift shifting
 *     real dates by a month in this estate. That happens when a date is built through a local-time
 *     `Date` and the runtime resolves the zone's pre-1955 local-mean-time offset (+05:53:28). A
 *     literal 330 cannot do that.
 *   - It also makes the whole file pure and testable with no ICU assumptions about the container.
 *
 * Display format is the estate rule: DD-MMM-YYYY (03-Aug-2026), never MM-DD-YYYY.
 */

export const IST_OFFSET_MIN = 330;
const MS_PER_MIN = 60_000;
const MS_PER_DAY = 86_400_000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The same instant, shifted so the UTC getters read off IST wall-clock values. Never returned. */
const asIstClock = (d: Date): Date => new Date(d.getTime() + IST_OFFSET_MIN * MS_PER_MIN);

const pad = (n: number): string => String(n).padStart(2, '0');

export interface IstParts {
  year: number;
  /** 1-12, not the 0-11 a Date uses. */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function istParts(d: Date): IstParts {
  const c = asIstClock(d);
  return {
    year: c.getUTCFullYear(),
    month: c.getUTCMonth() + 1,
    day: c.getUTCDate(),
    hour: c.getUTCHours(),
    minute: c.getUTCMinutes(),
  };
}

/** An IST wall-clock reading back to a real instant. */
export function fromIst(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MIN * MS_PER_MIN);
}

/** Minutes since IST midnight — what the quiet-hours window is expressed in. */
export function minuteOfDayIst(d: Date): number {
  const { hour, minute } = istParts(d);
  return hour * 60 + minute;
}

/** IST midnight of the day `d` falls on, as an instant. */
export function istStartOfDay(d: Date): Date {
  const { year, month, day } = istParts(d);
  return fromIst(year, month, day);
}

/** 03-Aug-2026 — the estate's date format. */
export function fmtDate(d: Date): string {
  const { year, month, day } = istParts(d);
  return `${pad(day)}-${MONTHS[month - 1]}-${year}`;
}

/** 09:05 */
export function fmtTime(d: Date): string {
  const { hour, minute } = istParts(d);
  return `${pad(hour)}:${pad(minute)}`;
}

/** 03-Aug-2026 09:05 */
export function fmtDateTime(d: Date): string {
  return `${fmtDate(d)} ${fmtTime(d)}`;
}

/** "20:30" for a minutes-from-midnight quiet-hours bound. */
export function fmtMinuteOfDay(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/**
 * `<input type="datetime-local">` speaks "YYYY-MM-DDTHH:mm" with NO zone, and the browser shows
 * whatever the user's machine calls local. We treat that string as IST unconditionally — the users
 * are all in India, and inferring the zone from the browser would mean a laptop left on a foreign
 * timezone silently schedules a batch for the wrong hour.
 */
export function fromIstInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = fromIst(Number(y), Number(mo), Number(d), Number(h), Number(mi));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The inverse — an instant back into the string a datetime-local input wants. */
export function toIstInput(d: Date): string {
  const { year, month, day, hour, minute } = istParts(d);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

/** Whole days between two instants, by IST calendar day. Used for "spans N days" in the preview. */
export function istDaySpan(from: Date, to: Date): number {
  return Math.round((istStartOfDay(to).getTime() - istStartOfDay(from).getTime()) / MS_PER_DAY);
}
