import { describe, it, expect } from 'vitest';
import { parseCsv, unitFromName, yearFromCell, dayFromCell, planImport, keyOf, IMPORT_COLUMNS } from './posh-import';

const HEAD = IMPORT_COLUMNS.map((c) => `"${c}"`).join(',');
/** A row in the old portal's own shape. Pending / % / Status / Next due hold deliberately WRONG
 *  values: they must be ignored, never used. */
function row(year: string, act: string, unit: string, total: string, done: string, last: string, comment = '') {
  return [year, act, unit, total, done, '999', '1%', 'complete', last, '01 Jan 1999', comment].map((v) => `"${v.replace(/"/g, '""')}"`).join(',');
}
const file = (name: string, ...rows: string[]) => ({ name, text: '﻿' + [HEAD, ...rows].join('\r\n') });
const none = new Set<string>();

describe('reading the CSV', () => {
  it('handles quotes, doubled quotes, commas and line breaks inside a field, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,"b,c","say ""hi""","two\nlines"\r\n1,2,3,4\n')).toEqual([
      ['a', 'b,c', 'say "hi"', 'two\nlines'],
      ['1', '2', '3', '4'],
    ]);
    expect(parseCsv('\n\n')).toEqual([]);
  });

  it('knows the units by the names the old portal writes, and by code', () => {
    expect(unitFromName('FP Vesu')).toBe('FPV');
    expect(unitFromName(' fp  adajan ')).toBe('FPA');
    expect(unitFromName('Group Operations')).toBe('GROUP');
    expect(unitFromName('FSK')).toBe('FSK');
    expect(unitFromName('FP Surat')).toBeNull();
    expect(unitFromName('')).toBeNull();
  });

  it('reads the year as the starting year, also in this app\'s own 2026–27 form', () => {
    expect(yearFromCell('2026')).toBe(2026);
    expect(yearFromCell('2026–27')).toBe(2026);
    expect(yearFromCell('2026-27')).toBe(2026);
    expect(yearFromCell('2026–28')).toBeNull();
    expect(yearFromCell('26')).toBeNull();
  });

  it('reads "01 Jul 2026" from the string, and refuses a day that does not exist', () => {
    expect(dayFromCell('01 Jul 2026')).toBe('2026-07-01');
    expect(dayFromCell('1 July 2026')).toBe('2026-07-01');
    expect(dayFromCell('03-Aug-2026')).toBe('2026-08-03');
    expect(dayFromCell('2026-07-01')).toBe('2026-07-01');
    expect(dayFromCell('31 Jun 2026')).toBeNull();
    expect(dayFromCell('07/01/2026')).toBeNull();
  });
});

describe('planImport', () => {
  it('copies Year, Act, Unit, Total, Completed, Last training and Comments exactly, ignoring the computed columns', () => {
    const plan = planImport([file('posh.csv', row('2025', 'POSH', 'FP Vesu', '120', '118', '01 Jul 2025', '  Session by HR, "batch 2"  '))], none, 2026);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].outcome).toEqual({
      kind: 'create',
      record: { year: 2025, act: 'POSH', unit: 'FPV', totalEmployees: 120, completed: 118, lastTraining: '2025-07-01', comments: '  Session by HR, "batch 2"  ' },
    });
    expect(plan.rows[0].line).toBe(2);
  });

  it('keeps blank as blank, never zero', () => {
    const plan = planImport([file('a.csv', row('2025', 'POCSO', 'FSK', '40', '', ''))], none, 2026);
    expect(plan.rows[0].outcome).toMatchObject({ kind: 'create', record: { totalEmployees: 40, completed: null, lastTraining: null, comments: null } });
  });

  it('never overwrites: a record already here is listed as skipped', () => {
    const existing = new Set([keyOf({ year: 2025, act: 'POSH', unit: 'FSK' })]);
    const plan = planImport([file('a.csv', row('2025', 'POSH', 'FSK', '10', '5', ''), row('2025', 'POSH', 'FSM', '10', '5', ''))], existing, 2026);
    expect(plan.rows.map((r) => r.outcome.kind)).toEqual(['existing', 'create']);
    expect(plan.counts).toEqual({ create: 1, existing: 1, empty: 0, refused: 0 });
  });

  it('REFUSES trained above the headcount (never clamps it), and says why', () => {
    const plan = planImport([file('a.csv', row('2025', 'POSH', 'FSK', '10', '12', ''))], none, 2026);
    expect(plan.rows[0].outcome).toEqual({ kind: 'refused', reason: 'Completed (12) is more than total employees (10).' });
  });

  it('refuses rows that do not make sense, each with its reason, and still imports the rest', () => {
    const plan = planImport(
      [
        file(
          'a.csv',
          row('2025', 'POSH', 'FP Surat', '10', '5', ''),
          row('2025', 'PoSH Act', 'FSK', '10', '5', ''),
          row('20x5', 'POSH', 'FSK', '10', '5', ''),
          row('2030', 'POSH', 'FSK', '10', '5', ''),
          row('2025', 'POSH', 'FSK', 'ten', '5', ''),
          row('2025', 'POSH', 'FSK', '', '5', ''),
          row('2025', 'POSH', 'FSK', '10', '5', '31 Jun 2025'),
          row('2025', 'POSH', 'FSK', '10', '-1', ''),
          row('2025', 'POSH', 'FWGS', '10', '5', ''),
        ),
      ],
      none,
      2026,
    );
    const reasons = plan.rows.map((r) => (r.outcome.kind === 'refused' ? r.outcome.reason : r.outcome.kind));
    expect(reasons).toEqual([
      '"FP Surat" is not one of the seven units.',
      '"PoSH Act" is not POSH or POCSO.',
      '"20x5" is not a year.',
      '2030 is outside the years this app keeps (2015 to 2027).',
      'Total employees "ten" is not a whole number.',
      'Completed is 5 but there is no total employees.',
      'Last training "31 Jun 2025" is not a date.',
      'Completed "-1" is not a whole number.',
      'create',
    ]);
  });

  it('skips the old portal\'s empty placeholder rows instead of creating blank records', () => {
    const plan = planImport([file('a.csv', row('2025', 'POSH', 'FALH', '', '', '', '  '))], none, 2026);
    expect(plan.rows[0].outcome).toEqual({ kind: 'empty', year: 2025, act: 'POSH', unit: 'FALH' });
  });

  it('refuses the same unit twice in one upload rather than guessing which is right', () => {
    const plan = planImport([file('a.csv', row('2025', 'POSH', 'FSK', '10', '5', '')), file('b.csv', row('2025–26', 'POSH', 'FSK', '11', '5', ''))], none, 2026);
    expect(plan.rows[0].outcome.kind).toBe('create');
    expect(plan.rows[1].outcome).toEqual({ kind: 'refused', reason: 'POSH FSK 2025–26 is already in this upload (a.csv line 2).' });
  });

  it('refuses a whole file that is not an old-portal export', () => {
    const plan = planImport([{ name: 'x.csv', text: 'Name,Email\nA,a@b.c' }, { name: 'e.csv', text: '' }], none, 2026);
    expect(plan.rows).toEqual([]);
    expect(plan.fileErrors).toEqual([
      { file: 'x.csv', reason: 'This is not an old-portal POSH export: no Year, Act, Unit, Total employees, Completed, Last training, Comments column.' },
      { file: 'e.csv', reason: 'This file is empty.' },
    ]);
  });

  it('reads this app\'s own CSV download back (2026–27 years, DD-MMM-YYYY dates)', () => {
    const plan = planImport([file('own.csv', row('2026–27', 'POCSO', 'Group Operations', '30', '30', '03-Aug-2026'))], none, 2026);
    expect(plan.rows[0].outcome).toMatchObject({ kind: 'create', record: { year: 2026, act: 'POCSO', unit: 'GROUP', lastTraining: '2026-08-03' } });
  });
});
