import { describe, it, expect } from 'vitest';
import {
  fmtDate,
  fmtDateTime,
  fmtMinuteOfDay,
  fmtTime,
  fromIst,
  fromIstInput,
  istDaySpan,
  istParts,
  istStartOfDay,
  minuteOfDayIst,
  toIstInput,
} from './ist';

describe('IST conversion', () => {
  it('reads an instant as IST wall-clock', () => {
    // 2026-08-16T03:30:00Z is exactly 09:00 IST.
    expect(istParts(new Date('2026-08-16T03:30:00Z'))).toEqual({
      year: 2026, month: 8, day: 16, hour: 9, minute: 0,
    });
  });

  it('round-trips a wall-clock reading', () => {
    const d = fromIst(2026, 8, 16, 9, 0);
    expect(d.toISOString()).toBe('2026-08-16T03:30:00.000Z');
    expect(istParts(d)).toMatchObject({ year: 2026, month: 8, day: 16, hour: 9, minute: 0 });
  });

  it('rolls the IST date forward across the UTC day boundary', () => {
    // 18:30Z onwards is already the next day in India — the classic off-by-one.
    expect(fmtDate(new Date('2026-08-16T18:29:00Z'))).toBe('16-Aug-2026');
    expect(fmtDate(new Date('2026-08-16T18:30:00Z'))).toBe('17-Aug-2026');
  });

  it('does NOT drift by the Asia/Calcutta LMT offset', () => {
    // If this ever went through a zone database and resolved pre-1955 local mean time (+05:53:28),
    // 00:10 IST would come back as 00:03 — and dates near midnight would shift a day.
    const midnightish = fromIst(2026, 1, 1, 0, 10);
    expect(fmtDateTime(midnightish)).toBe('01-Jan-2026 00:10');
    expect(minuteOfDayIst(midnightish)).toBe(10);
  });
});

describe('formatting', () => {
  it('uses DD-MMM-YYYY, never MM-DD-YYYY', () => {
    // 03-Aug is unambiguous; an American format would render this 08-03.
    expect(fmtDate(fromIst(2026, 8, 3, 12, 0))).toBe('03-Aug-2026');
  });

  it('zero-pads the clock', () => {
    expect(fmtTime(fromIst(2026, 8, 3, 9, 5))).toBe('09:05');
    expect(fmtDateTime(fromIst(2026, 12, 25, 18, 45))).toBe('25-Dec-2026 18:45');
  });

  it('renders minutes-from-midnight', () => {
    expect(fmtMinuteOfDay(0)).toBe('00:00');
    expect(fmtMinuteOfDay(480)).toBe('08:00');
    expect(fmtMinuteOfDay(1230)).toBe('20:30');
    expect(fmtMinuteOfDay(1440)).toBe('00:00');
  });
});

describe('datetime-local input', () => {
  it('reads the browser string as IST regardless of the machine timezone', () => {
    expect(fromIstInput('2026-08-16T09:00')?.toISOString()).toBe('2026-08-16T03:30:00.000Z');
  });

  it('tolerates a seconds component', () => {
    expect(fromIstInput('2026-08-16T09:00:00')?.toISOString()).toBe('2026-08-16T03:30:00.000Z');
  });

  it('rejects junk rather than guessing', () => {
    expect(fromIstInput('')).toBeNull();
    expect(fromIstInput('tomorrow')).toBeNull();
    expect(fromIstInput('16-08-2026 09:00')).toBeNull();
  });

  it('round-trips', () => {
    const s = '2026-11-02T07:45';
    expect(toIstInput(fromIstInput(s)!)).toBe(s);
  });
});

describe('day arithmetic', () => {
  it('counts IST calendar days, not 24h blocks', () => {
    const late = fromIst(2026, 8, 16, 23, 30);
    const early = fromIst(2026, 8, 17, 0, 30);
    expect(istDaySpan(late, early)).toBe(1); // one hour apart, but a different day
  });

  it('is zero within one IST day', () => {
    expect(istDaySpan(fromIst(2026, 8, 16, 0, 1), fromIst(2026, 8, 16, 23, 59))).toBe(0);
  });

  it('gives IST midnight', () => {
    expect(istStartOfDay(fromIst(2026, 8, 16, 14, 22)).toISOString()).toBe('2026-08-15T18:30:00.000Z');
  });
});
