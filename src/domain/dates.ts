// 日付（§8.1）。午前4時を境界にした論理日を使う。日付文字列を toISOString() で作らない
import {
  addDays as dfAddDays,
  differenceInCalendarDays,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
} from 'date-fns';
import type { EpochMs, LocalDate } from './types';

export const DAY_BOUNDARY_HOUR = 4;

/** 暦の日付（境界なし）。日付入力欄の値の変換にだけ使う */
export function toLocalDate(d: Date): LocalDate {
  return format(d, 'yyyy-MM-dd');
}

/** その日のローカル12:00の Date（DST の影響を避けるため正午） */
export function parseLocalDate(s: LocalDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** 瞬間 → 論理日。ローカル時刻で4時より前なら前日 */
export function logicalDate(ms: EpochMs): LocalDate {
  const d = new Date(ms);
  const day = d.getHours() < DAY_BOUNDARY_HOUR ? dfAddDays(d, -1) : d;
  return toLocalDate(day);
}

/** 論理日の別名【着】 */
export const dayKey = logicalDate;

/** その論理日が始まる瞬間（その日のローカル4:00） */
export function dayStart(d: LocalDate): EpochMs {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day, DAY_BOUNDARY_HOUR, 0, 0, 0).getTime();
}

export function addDays(s: LocalDate, n: number): LocalDate {
  return toLocalDate(dfAddDays(parseLocalDate(s), n));
}

/** a − b の日数（暦日） */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return differenceInCalendarDays(parseLocalDate(a), parseLocalDate(b));
}

/** 0=日〜6=土 */
export function weekdayOf(s: LocalDate): number {
  return parseLocalDate(s).getDay();
}

/** その日を含む ISO 週の月曜 */
export function weekStartOf(s: LocalDate): LocalDate {
  return toLocalDate(startOfISOWeek(parseLocalDate(s)));
}

/** '2026-W43' 形式 */
export function isoWeekKey(s: LocalDate): string {
  const d = parseLocalDate(s);
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`;
}

/** 両端を含む */
export function inRange(d: LocalDate, from: LocalDate, to: LocalDate): boolean {
  return from <= d && d <= to;
}
