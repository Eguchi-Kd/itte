import { describe, expect, it } from 'vitest';
import { formatAmount, formatDateShort, formatMmSs, formatRatio } from '../display';
import { DomainError, isDomainError } from '../errors';

describe('display', () => {
  it('formatDateShort', () => {
    expect(formatDateShort('2026-10-16')).toBe('10/16(金)');
    expect(formatDateShort('2026-10-18')).toBe('10/18(日)');
    expect(formatDateShort('2027-01-04')).toBe('1/4(月)');
  });

  it('formatMmSs', () => {
    expect(formatMmSs(372000)).toBe('6:12');
    expect(formatMmSs(600000)).toBe('10:00');
    expect(formatMmSs(0)).toBe('0:00');
    expect(formatMmSs(-5)).toBe('0:00');
  });

  it('formatAmount と formatRatio', () => {
    expect(formatAmount(55, '分')).toBe('55分');
    expect(formatRatio(4, 6)).toBe('4/6 回');
  });
});

describe('DomainError', () => {
  it('code と copyKey を持つ', () => {
    const e = new DomainError('OUT_OF_WINDOW', 'errors.outOfWindow', { date: '2026-10-14' });
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('OUT_OF_WINDOW');
    expect(e.copyKey).toBe('errors.outOfWindow');
    expect(isDomainError(e, 'OUT_OF_WINDOW')).toBe(true);
    expect(isDomainError(e, 'VALIDATION')).toBe(false);
    expect(isDomainError(new Error('x'))).toBe(false);
  });
});
