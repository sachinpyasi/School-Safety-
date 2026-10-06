/**
 * "Import from old portal": the old portal's POSH / POCSO "⬇ CSV" files → records to create. Pure:
 * no I/O. lib/posh-import.ts reads what already exists and writes; this decides, row by row.
 *
 * The rule (docs/RULES.md §Data, "past records are frozen"): copy EXACTLY what the old portal holds,
 * never recalculate. So only Year, Act, Unit, Total employees, Completed, Last training and Comments
 * are read. Pending, % completed, Status and Next due are the old portal's own arithmetic, which this
 * app works out for itself; they are ignored, never checked against, never stored.
 *
 * Each row is one of:
 *   create   — new for its (year, act, unit): it will be saved as it is
 *   existing — this app already holds that (year, act, unit): left alone, NEVER overwritten
 *   empty    — the old portal's placeholder row (nothing filled in): nothing to copy
 *   refused  — does not make sense (unknown unit, trained above headcount, …), with the reason
 * Refusing a row never changes another: the rest of the file is still imported.
 */
import { MAX_COMMENT, MAX_HEADCOUNT, POSH_UNITS, isAct, isIsoDay, yearLabel, type PoshAct, type PoshUnit } from './posh';

/** The columns the old portal writes, in its order (and this app's own CSV download). */
export const IMPORT_COLUMNS = [
  'Year',
  'Act',
  'Unit',
  'Total employees',
  'Completed',
  'Pending',
  '% completed',
  'Status',
  'Last training',
  'Next due',
  'Comments',
] as const;

/** The only columns that are read. Everything else is the old portal's arithmetic. */
export const REQUIRED_COLUMNS = ['Year', 'Act', 'Unit', 'Total employees', 'Completed', 'Last training', 'Comments'] as const;

/** A sanity ceiling so a wrong file (a whole spreadsheet export) is refused, not half-read. */
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 1_000_000;

/** RFC 4180: quoted fields, doubled quotes, commas and line breaks inside quotes, CRLF or LF.
 *  A leading byte-order mark (Excel, and the old portal's own export) is dropped. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // A line with nothing on it at all is not a row (trailing newline, blank line between blocks).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** 'FP Vesu' / 'fp vesu' / 'FPV' → 'FPV'. The old portal writes the display name. */
export function unitFromName(raw: string): PoshUnit | null {
  const s = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!s) return null;
  return POSH_UNITS.find((u) => u.name.toLowerCase() === s || u.code.toLowerCase() === s)?.code ?? null;
}

/** '2026' → 2026. Also this app's own download ('2026–27', '2026-27'), but only when the second half
 *  really is the next year: '2026–28' is not a year this file could mean. */
export function yearFromCell(raw: string): number | null {
  const m = /^(\d{4})(?:\s*[–-]\s*(\d{2}))?$/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  if (m[2] !== undefined && Number(m[2]) !== (y + 1) % 100) return null;
  return y;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** '01 Jul 2026' (the old portal) or '01-Jul-2026' (this app) or '2026-07-01' → '2026-07-01'.
 *  Built from the text, never through a Date: what the file says is the day stored. Anything else,
 *  including a day that does not exist ('31 Jun 2026'), is null. */
export function dayFromCell(raw: string): string | null {
  const s = raw.trim();
  if (isIsoDay(s)) return s;
  const m = /^(\d{1,2})[\s-]+([A-Za-z]{3})[A-Za-z]*[\s-]+(\d{4})$/.exec(s);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  const iso = `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isIsoDay(iso) ? iso : null;
}

function countCell(raw: string): number | null | 'bad' {
  const s = raw.trim();
  if (s === '') return null;
  if (!/^\d+$/.test(s)) return 'bad';
  const n = Number(s);
  return n > MAX_HEADCOUNT ? 'bad' : n;
}

/** One record as it will be stored. */
export interface ImportRecord {
  year: number;
  act: PoshAct;
  unit: PoshUnit;
  totalEmployees: number | null;
  completed: number | null;
  lastTraining: string | null;
  comments: string | null;
}

export type RowOutcome =
  | { kind: 'create'; record: ImportRecord }
  | { kind: 'existing'; record: ImportRecord }
  | { kind: 'empty'; year: number; act: PoshAct; unit: PoshUnit }
  | { kind: 'refused'; reason: string };

export interface ImportRow {
  file: string;
  /** The line in the file, counting the header as line 1, so a person can find it. */
  line: number;
  /** The row's Year / Act / Unit cells as written, for the preview. */
  label: string;
  outcome: RowOutcome;
}

export interface ImportFile {
  name: string;
  text: string;
}

export interface ImportPlan {
  rows: ImportRow[];
  /** A whole file that could not be read at all (wrong columns, too big). */
  fileErrors: { file: string; reason: string }[];
  counts: { create: number; existing: number; empty: number; refused: number };
}

export const keyOf = (r: { year: number; act: string; unit: string }) => `${r.year}|${r.act}|${r.unit}`;

/**
 * Every row of every file → what happens to it. `existing` holds the (year, act, unit) keys this app
 * already has. Nothing here can change a stored record: an existing key is only ever "skipped".
 */
export function planImport(files: readonly ImportFile[], existing: ReadonlySet<string>, currentYear: number): ImportPlan {
  const rows: ImportRow[] = [];
  const fileErrors: ImportPlan['fileErrors'] = [];
  const seen = new Map<string, string>(); // key → where it was first seen in this upload
  let total = 0;

  for (const f of files) {
    if (f.text.length > MAX_IMPORT_BYTES) {
      fileErrors.push({ file: f.name, reason: 'This file is too large to be an old-portal POSH export.' });
      continue;
    }
    const table = parseCsv(f.text);
    if (table.length === 0) {
      fileErrors.push({ file: f.name, reason: 'This file is empty.' });
      continue;
    }
    const head = table[0].map((h) => h.trim().toLowerCase());
    const col = Object.fromEntries(REQUIRED_COLUMNS.map((c) => [c, head.indexOf(c.toLowerCase())])) as Record<
      (typeof REQUIRED_COLUMNS)[number],
      number
    >;
    const missing = REQUIRED_COLUMNS.filter((c) => col[c] < 0);
    if (missing.length > 0) {
      fileErrors.push({ file: f.name, reason: `This is not an old-portal POSH export: no ${missing.join(', ')} column.` });
      continue;
    }
    total += table.length - 1;
    if (total > MAX_IMPORT_ROWS) {
      fileErrors.push({ file: f.name, reason: `Too many rows (over ${MAX_IMPORT_ROWS}). Upload fewer files at a time.` });
      continue;
    }

    table.slice(1).forEach((cells, i) => {
      const cell = (c: (typeof REQUIRED_COLUMNS)[number]) => cells[col[c]] ?? '';
      const label = [cell('Year'), cell('Act'), cell('Unit')].map((v) => v.trim()).join(' · ');
      const push = (outcome: RowOutcome) => rows.push({ file: f.name, line: i + 2, label, outcome });
      const refuse = (reason: string) => push({ kind: 'refused', reason });

      const year = yearFromCell(cell('Year'));
      if (year === null) return refuse(`"${cell('Year').trim()}" is not a year.`);
      if (year < 2015 || year > currentYear + 1) return refuse(`${year} is outside the years this app keeps (2015 to ${currentYear + 1}).`);
      const actRaw = cell('Act').trim().toUpperCase();
      if (!isAct(actRaw)) return refuse(`"${cell('Act').trim()}" is not POSH or POCSO.`);
      const act: PoshAct = actRaw;
      const unit = unitFromName(cell('Unit'));
      if (!unit) return refuse(`"${cell('Unit').trim()}" is not one of the seven units.`);

      const totalEmployees = countCell(cell('Total employees'));
      if (totalEmployees === 'bad') return refuse(`Total employees "${cell('Total employees').trim()}" is not a whole number.`);
      const completed = countCell(cell('Completed'));
      if (completed === 'bad') return refuse(`Completed "${cell('Completed').trim()}" is not a whole number.`);
      const lastRaw = cell('Last training').trim();
      const lastTraining = lastRaw === '' ? null : dayFromCell(lastRaw);
      if (lastRaw !== '' && lastTraining === null) return refuse(`Last training "${lastRaw}" is not a date.`);
      // Comments are copied as written. Only a cell that is nothing but spaces counts as no comment.
      const commentRaw = cell('Comments');
      const comments = commentRaw.trim() === '' ? null : commentRaw;

      if (totalEmployees === null && completed === null && lastTraining === null && comments === null) {
        return push({ kind: 'empty', year, act, unit });
      }
      if (completed !== null && totalEmployees === null) return refuse(`Completed is ${completed} but there is no total employees.`);
      if (completed !== null && totalEmployees !== null && completed > totalEmployees) {
        return refuse(`Completed (${completed}) is more than total employees (${totalEmployees}).`);
      }
      if (comments !== null && comments.length > MAX_COMMENT) return refuse(`The comment is longer than ${MAX_COMMENT} characters.`);

      const key = keyOf({ year, act, unit });
      const where = `${f.name} line ${i + 2}`;
      const first = seen.get(key);
      if (first) return refuse(`${act} ${unit} ${yearLabel(year)} is already in this upload (${first}).`);
      seen.set(key, where);

      const record: ImportRecord = { year, act, unit, totalEmployees, completed, lastTraining, comments };
      push(existing.has(key) ? { kind: 'existing', record } : { kind: 'create', record });
    });
  }

  const counts = { create: 0, existing: 0, empty: 0, refused: 0 };
  for (const r of rows) counts[r.outcome.kind]++;
  return { rows, fileErrors, counts };
}
