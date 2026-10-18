import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayKey,
  dayStart,
  diffDays,
  inRange,
  isoWeekKey,
  logicalDate,
  parseLocalDate,
  toLocalDate,
  weekdayOf,
  weekStartOf,
} from '../dates';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('logicalDate', () => {
  it('AC-CORE-01: 3:59 を前日、4:00 を当日として扱う', () => {
    expect(logicalDate(at(2026, 10, 19, 3, 59))).toBe('2026-10-18');
    expect(logicalDate(at(2026, 10, 19, 4, 0))).toBe('2026-10-19');
  });

  it('AC-CORE-01: 0:00 は前日、23:59 は当日。月と年をまたいでも前日になる', () => {
    expect(logicalDate(at(2026, 10, 19, 0, 0))).toBe('2026-10-18');
    expect(logicalDate(at(2026, 10, 18, 23, 59))).toBe('2026-10-18');
    expect(logicalDate(at(2026, 11, 1, 1, 0))).toBe('2026-10-31');
    expect(logicalDate(at(2027, 1, 1, 3, 0))).toBe('2026-12-31');
  });

  it('dayKey は logicalDate の別名', () => {
    expect(dayKey).toBe(logicalDate);
  });

  it('dayStart はその論理日のローカル4:00', () => {
    expect(dayStart('2026-10-19')).toBe(at(2026, 10, 19, 4, 0));
    expect(logicalDate(dayStart('2026-10-19'))).toBe('2026-10-19');
    expect(logicalDate(dayStart('2026-10-19') - 1)).toBe('2026-10-18');
  });
});

describe('週', () => {
  it('AC-CORE-02: 月曜3:59 の weekStartOf(logicalDate(…)) は前週の月曜', () => {
    expect(weekStartOf(logicalDate(at(2026, 10, 19, 3, 59)))).toBe('2026-10-12');
    expect(weekStartOf(logicalDate(at(2026, 10, 19, 4, 0)))).toBe('2026-10-19');
  });

  it('AC-CORE-02: isoWeekKey が ISO 週を返す', () => {
    expect(isoWeekKey('2026-10-19')).toBe('2026-W43');
    expect(isoWeekKey('2026-10-18')).toBe('2026-W42');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
    expect(isoWeekKey('2025-12-29')).toBe('2026-W01');
    expect(isoWeekKey('2027-01-04')).toBe('2027-W01');
  });

  it('weekStartOf は日曜を同じ週の月曜にする', () => {
    expect(weekStartOf('2026-10-18')).toBe('2026-10-12');
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12');
  });
});

describe('日付の計算', () => {
  it('addDays と diffDays', () => {
    expect(addDays('2026-10-18', 1)).toBe('2026-10-19');
    expect(addDays('2026-10-18', -18)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-10-19', '2026-10-18')).toBe(1);
    expect(diffDays('2026-10-15', '2026-10-18')).toBe(-3);
    expect(diffDays('2027-01-01', '2026-01-01')).toBe(365);
  });

  it('weekdayOf は 0=日〜6=土', () => {
    expect(weekdayOf('2026-10-18')).toBe(0);
    expect(weekdayOf('2026-10-19')).toBe(1);
    expect(weekdayOf('2026-10-24')).toBe(6);
  });

  it('parseLocalDate は正午、toLocalDate は境界なしの暦日', () => {
    const d = parseLocalDate('2026-10-18');
    expect(d.getHours()).toBe(12);
    expect(toLocalDate(d)).toBe('2026-10-18');
    expect(toLocalDate(new Date(2026, 9, 19, 1, 0))).toBe('2026-10-19');
  });

  it('inRange は両端を含む', () => {
    expect(inRange('2026-10-15', '2026-10-15', '2026-10-18')).toBe(true);
    expect(inRange('2026-10-18', '2026-10-15', '2026-10-18')).toBe(true);
    expect(inRange('2026-10-19', '2026-10-15', '2026-10-18')).toBe(false);
    expect(inRange('2026-10-14', '2026-10-15', '2026-10-18')).toBe(false);
  });
});
