import { describe, it, expect } from 'vitest';
import {
  actionClass,
  actionLabel,
  actionShort,
  buildPresence,
  daysBefore,
  daysSpanned,
  DAY_START_HOUR,
  enforceSelfView,
  istDayRange,
  MACHINE_ACTIONS,
  registerTimeLabel,
  resolveActivityScope,
  SIGN_IN_ACTION,
  summariseDetail,
} from './activity';

describe('resolveActivityScope', () => {
  const today = '2026-09-08';

  it('defaults from/to to today and everything else to null/false', () => {
    expect(resolveActivityScope({}, today)).toEqual({
      from: today, to: today, actor: null, action: null, actorExact: false, withSignIns: false,
    });
  });

  it('swaps a reversed range rather than returning an empty one', () => {
    const s = resolveActivityScope({ from: '2026-09-10', to: '2026-09-01' }, today);
    expect([s.from, s.to]).toEqual(['2026-09-01', '2026-09-10']);
  });

  it('rejects a malformed date and falls back to today', () => {
    expect(resolveActivityScope({ from: 'not-a-date' }, today).from).toBe(today);
    expect(resolveActivityScope({ to: '2026-13-40' }, today).to).toBe(today);
  });

  it('accepts dotted action keys and rejects anything else', () => {
    expect(resolveActivityScope({ action: 'posh.save' }, today).action).toBe('posh.save');
    expect(resolveActivityScope({ action: 'sign_in' }, today).action).toBe('sign_in');
    expect(resolveActivityScope({ action: "x' OR 1=1" }, today).action).toBeNull();
  });

  it('reads ?signins=1 and nothing else as the sign-in toggle', () => {
    expect(resolveActivityScope({ signins: '1' }, today).withSignIns).toBe(true);
    expect(resolveActivityScope({ signins: 'true' }, today).withSignIns).toBe(false);
  });
});

describe('enforceSelfView (ruling 3)', () => {
  const base = resolveActivityScope({ actor: 'someone-else@fwgs.in' }, '2026-09-08');

  it('leaves an admin scope alone', () => {
    expect(enforceSelfView(base, true, 'admin@fwgs.in')).toBe(base);
  });

  it('OVERWRITES a non-admin actor filter with their own email, exactly', () => {
    const s = enforceSelfView(base, false, ' J.Patel@FWGS.in ');
    expect(s.actor).toBe('j.patel@fwgs.in');
    expect(s.actorExact).toBe(true);
    expect(s.withSignIns).toBe(base.withSignIns);
  });
});

describe('IST day arithmetic', () => {
  it('istDayRange covers the IST calendar day as a UTC instant range', () => {
    const r = istDayRange('2026-09-08', '2026-09-08');
    expect(r.gte.toISOString()).toBe('2026-09-07T18:30:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-09-08T18:30:00.000Z');
  });

  it('daysBefore rolls back across a month boundary', () => {
    expect(daysBefore('2026-09-03', 6)).toBe('2026-08-28');
    expect(daysBefore('2026-01-01', 1)).toBe('2025-12-31');
  });

  it('daysSpanned is inclusive', () => {
    expect(daysSpanned('2026-09-08', '2026-09-08')).toBe(1);
    expect(daysSpanned('2026-09-02', '2026-09-08')).toBe(7);
  });
});

describe('buildPresence', () => {
  it('buckets by IST hour, always 24 wide, and flags out-of-hours sign-ins', () => {
    const p = buildPresence(
      [new Date('2026-09-08T03:30:00Z') /* 09:00 IST */, new Date('2026-09-08T03:45:00Z'), new Date('2026-09-07T20:00:00Z') /* 01:30 IST */],
      2,
      1,
    );
    expect(p.hours).toHaveLength(24);
    expect(p.hours[9]).toBe(2);
    expect(p.hours[1]).toBe(1);
    expect(p.total).toBe(3);
    expect(p.people).toBe(2);
    expect(p.outOfHours).toBe(1);
    expect(1 < DAY_START_HOUR).toBe(true);
  });
});

describe('labels and classes', () => {
  it('the sign-in key is the estate spelling and there are no machine actions here', () => {
    expect(SIGN_IN_ACTION).toBe('sign_in');
    expect(MACHINE_ACTIONS).toEqual([]);
  });

  it('classes every action, louder wins, unknown degrades to write', () => {
    expect(actionClass('posh.delete_year')).toBe('destructive');
    expect(actionClass('right.grant')).toBe('access');
    expect(actionClass('right.revoke')).toBe('access');
    expect(actionClass('posh.save')).toBe('write');
    expect(actionClass('sign_in')).toBe('sign');
    expect(actionClass('something.new')).toBe('write');
  });

  it('labels fall back to a readable form for an unknown key', () => {
    expect(actionLabel('posh.save')).toBe('Saved a POSH / POCSO record');
    expect(actionShort('posh.save')).toBe('save');
    expect(actionLabel('future.thing')).toBe('Future thing');
  });

  it('registerTimeLabel drops the day on a single-day range and the year across days', () => {
    const at = new Date('2026-09-08T03:30:00Z');
    expect(registerTimeLabel(at, true)).toBe('09:00');
    expect(registerTimeLabel(at, false)).toBe('08-Sep 09:00');
  });

  it('summariseDetail flattens an object to key: value and collapses nested shapes', () => {
    expect(summariseDetail({ sections: 8, links: [1, 2], meta: { a: 1 }, gone: null })).toBe('sections: 8 · links: [2] · meta: {…} · gone: —');
    expect(summariseDetail(null)).toBe('');
    expect(summariseDetail('x'.repeat(200), 20)).toHaveLength(20);
  });
});
