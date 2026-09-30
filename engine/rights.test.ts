import { describe, it, expect } from 'vitest';
import { canEditUnit, canEditAny, parseGrantUnit } from './rights';

describe('canEditUnit', () => {
  it('grants nothing to somebody with no grant: signing in is not a right', () => {
    expect(canEditUnit([], false, 'FSK')).toBe(false);
    expect(canEditAny([], false)).toBe(false);
  });

  it('a unit grant covers that unit only', () => {
    const g = [{ unit: 'FSK' }];
    expect(canEditUnit(g, false, 'FSK')).toBe(true);
    expect(canEditUnit(g, false, 'FSM')).toBe(false);
    expect(canEditUnit(g, false, 'GROUP')).toBe(false);
  });

  it('GROUP is a unit like any other, not something a school grant reaches', () => {
    expect(canEditUnit([{ unit: 'GROUP' }], false, 'GROUP')).toBe(true);
    expect(canEditUnit([{ unit: 'FSK' }, { unit: 'FWGS' }], false, 'GROUP')).toBe(false);
  });

  it('an every-unit grant (null) covers every unit, GROUP included', () => {
    for (const u of ['FSK', 'FWGS', 'FSM', 'FALH', 'FPV', 'FPA', 'GROUP']) expect(canEditUnit([{ unit: null }], false, u)).toBe(true);
  });

  it('refuses a unit that does not exist, for everyone, admin included', () => {
    expect(canEditUnit([{ unit: null }], false, 'XYZ')).toBe(false);
    expect(canEditUnit([], true, 'XYZ')).toBe(false);
    expect(canEditUnit([], true, 'FSK')).toBe(true);
  });
});

describe('parseGrantUnit', () => {
  it('reads ALL as every unit and a code as that unit', () => {
    expect(parseGrantUnit('ALL')).toBeNull();
    expect(parseGrantUnit('all')).toBeNull();
    expect(parseGrantUnit('fpv')).toBe('FPV');
  });

  it('REFUSES an empty choice rather than reading it as every unit', () => {
    expect(parseGrantUnit('')).toBeUndefined();
    expect(parseGrantUnit(undefined)).toBeUndefined();
    expect(parseGrantUnit('   ')).toBeUndefined();
    expect(parseGrantUnit('XYZ')).toBeUndefined();
  });
});
