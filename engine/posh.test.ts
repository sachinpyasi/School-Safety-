import { describe, it, expect } from 'vitest';
import {
  academicYear,
  yearLabel,
  parseYear,
  parseAct,
  dueDate,
  daysBetween,
  band,
  toCard,
  buildCards,
  summarise,
  parsePoshEdit,
  csvRows,
  toCsv,
  dayLabel,
  isIsoDay,
  POSH_UNITS,
  DUE_SOON_DAYS,
} from './posh';

const blank = { totalEmployees: null, completed: null, lastTraining: null, comments: null };

describe('academic year (June to May)', () => {
  it('starts in June and is named by its first calendar year', () => {
    expect(academicYear('2026-06-01')).toBe(2026);
    expect(academicYear('2026-05-31')).toBe(2025);
    expect(academicYear('2027-03-01')).toBe(2026);
    expect(yearLabel(2026)).toBe('2026–27');
    expect(yearLabel(2099)).toBe('2099–00');
  });

  it('parses ?year= and falls back to the current year for anything implausible', () => {
    expect(parseYear('2025', 2026)).toBe(2025);
    expect(parseYear('2027', 2026)).toBe(2027); // next year may be planned
    expect(parseYear('2028', 2026)).toBe(2026);
    expect(parseYear('2014', 2026)).toBe(2026);
    expect(parseYear('20x6', 2026)).toBe(2026);
    expect(parseYear(undefined, 2026)).toBe(2026);
  });

  it('parses ?act=, POSH by default', () => {
    expect(parseAct('POCSO')).toBe('POCSO');
    expect(parseAct('pocso')).toBe('POSH');
    expect(parseAct(undefined)).toBe('POSH');
  });
});

describe('dates are strings, done on their parts', () => {
  it('knows a real day from a malformed one', () => {
    expect(isIsoDay('2026-02-28')).toBe(true);
    expect(isIsoDay('2028-02-29')).toBe(true);
    expect(isIsoDay('2026-02-29')).toBe(false);
    expect(isIsoDay('2026-13-01')).toBe(false);
    expect(isIsoDay('26-02-2026')).toBe(false);
  });

  it('falls due a year after the session, 29-Feb landing on 28-Feb', () => {
    expect(dueDate('2025-08-14')).toBe('2026-08-14');
    expect(dueDate('2028-02-29')).toBe('2029-02-28');
    expect(dueDate(null)).toBeNull();
    expect(dueDate('not a date')).toBeNull();
  });

  it('counts days across a month and a year boundary', () => {
    expect(daysBetween('2026-09-26', '2026-09-26')).toBe(0);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-09-26', '2026-08-27')).toBe(-30);
  });

  it('shows DD-MMM-YYYY, built from the string', () => {
    expect(dayLabel('2026-08-03')).toBe('03-Aug-2026');
  });
});

describe('the status word (legacy poshBand_, rule for rule)', () => {
  it('is "not started" with no headcount, whatever else is set', () => {
    expect(band(null, null, null).key).toBe('none');
    expect(band(0, 0, 200).key).toBe('none');
  });

  it('is overdue past the renewal date even when everyone was trained', () => {
    expect(band(120, 120, -1)).toEqual({ key: 'expired', label: 'overdue' });
  });

  it('counts the people still to train, and turns urgent inside the window', () => {
    expect(band(120, 118, 200)).toEqual({ key: 'open', label: '2 pending' });
    expect(band(120, 118, DUE_SOON_DAYS - 1).key).toBe('urgent');
    expect(band(120, 118, DUE_SOON_DAYS).key).toBe('open'); // the window is strict, as in legacy
    expect(band(120, null, null)).toEqual({ key: 'open', label: '120 pending' });
  });

  it('is complete when everyone is trained, "renewal near" inside the window', () => {
    expect(band(120, 120, 200)).toEqual({ key: 'ok', label: 'complete' });
    expect(band(120, 120, 10).key).toBe('soon');
    expect(band(120, 120, null).key).toBe('ok'); // no session date: nothing to renew against yet
  });
});

describe('cards and the figures above them', () => {
  const today = '2026-09-26';

  it('always shows all seven units in the sheet order, blank where nothing is stored', () => {
    const cards = buildCards([{ unit: 'FSM', ...blank, totalEmployees: 10, completed: 4 }], today);
    expect(cards.map((c) => c.unit)).toEqual(POSH_UNITS.map((u) => u.code));
    expect(cards.find((c) => c.unit === 'FSM')).toMatchObject({ total: 10, completed: 4, pending: 6, pct: 40 });
    expect(cards.find((c) => c.unit === 'FSK')).toMatchObject({ total: null, pct: null, band: { key: 'none' } });
    expect(cards.find((c) => c.unit === 'GROUP')!.name).toBe('Group Operations');
  });

  it('computes the due date and days left from the session date', () => {
    const c = toCard({ unit: 'FSK', ...blank, totalEmployees: 5, completed: 5, lastTraining: '2025-10-06' }, today);
    expect(c.due).toBe('2026-10-06');
    expect(c.daysLeft).toBe(10);
    expect(c.band.key).toBe('soon');
  });

  it('leaves units with no headcount out of the totals, and says how many', () => {
    const cards = buildCards(
      [
        { unit: 'FSK', ...blank, totalEmployees: 100, completed: 100 },
        { unit: 'FWGS', ...blank, totalEmployees: 50, completed: 20 },
      ],
      today,
    );
    expect(summarise(cards)).toEqual({
      employees: 150,
      trained: 120,
      pending: 30,
      overallPct: 80,
      unitsComplete: 1,
      unitsPending: 1,
      unitsNotStarted: 5,
    });
  });

  it('has no overall percentage, rather than 0%, when nothing has a headcount', () => {
    expect(summarise(buildCards([], today)).overallPct).toBeNull();
  });
});

describe('parsePoshEdit: the server’s last word', () => {
  const ok = { year: '2026', act: 'POSH', unit: 'FSK', totalEmployees: '120', completed: '118', lastTraining: '2026-07-01', comments: ' refresher booked ' };

  it('accepts a good edit and normalises it', () => {
    expect(parsePoshEdit(ok, 2026)).toEqual({
      ok: true,
      value: { year: 2026, act: 'POSH', unit: 'FSK', totalEmployees: 120, completed: 118, lastTraining: '2026-07-01', comments: 'refresher booked' },
    });
  });

  it('keeps blank apart from zero', () => {
    const r = parsePoshEdit({ ...ok, totalEmployees: '', completed: '', lastTraining: '', comments: '' }, 2026);
    expect(r).toMatchObject({ ok: true, value: { totalEmployees: null, completed: null, lastTraining: null, comments: null } });
    const z = parsePoshEdit({ ...ok, totalEmployees: '0', completed: '0' }, 2026);
    expect(z).toMatchObject({ ok: true, value: { totalEmployees: 0, completed: 0 } });
  });

  it('REFUSES trained above the headcount rather than clamping it, as legacy did', () => {
    const r = parsePoshEdit({ ...ok, completed: '121' }, 2026);
    expect(r).toEqual({ ok: false, error: 'Trained (121) cannot be more than the total employees (120).' });
  });

  it('refuses a trained count with no headcount to measure it against', () => {
    expect(parsePoshEdit({ ...ok, totalEmployees: '' }, 2026)).toMatchObject({ ok: false });
  });

  it('refuses what a hand-built post could send', () => {
    for (const bad of [
      { unit: 'XYZ' },
      { unit: 'fsk' },
      { act: 'OTHER' },
      { year: '1999' },
      { year: '2028' },
      { year: 'abcd' },
      { totalEmployees: '-3' },
      { totalEmployees: '12.5' },
      { totalEmployees: '1e3' },
      { totalEmployees: '100001' },
      { lastTraining: '2026-02-30' },
      { lastTraining: '01-07-2026' },
      { comments: 'x'.repeat(501) },
    ]) {
      expect(parsePoshEdit({ ...ok, ...bad }, 2026), JSON.stringify(bad)).toMatchObject({ ok: false });
    }
  });
});

describe('CSV export', () => {
  it('carries the legacy columns, with estate dates', () => {
    const rows = csvRows(2026, 'POCSO', buildCards([{ unit: 'FSK', ...blank, totalEmployees: 4, completed: 3, lastTraining: '2026-07-01' }], '2026-09-26'));
    expect(rows[0]).toEqual(['Year', 'Act', 'Unit', 'Total employees', 'Completed', 'Pending', '% completed', 'Status', 'Last training', 'Next due', 'Comments']);
    expect(rows[1]).toEqual(['2026–27', 'POCSO', 'FSK', '4', '3', '1', '75%', '1 pending', '01-Jul-2026', '01-Jul-2027', '']);
    expect(rows).toHaveLength(8);
  });

  it('quotes every field, doubles quotes, and defuses spreadsheet formulas', () => {
    expect(toCsv([['a "b"', '=HYPERLINK("x")', '-1', 'plain']])).toBe('"a ""b""","\'=HYPERLINK(""x"")","\'-1","plain"');
  });
});
