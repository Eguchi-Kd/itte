// 自動化と卒業（§8.2.6）
import { diffDays } from '../dates';
import type { Habit, HabitLog, LocalDate, WeeklyCheck } from '../types';
import { recentRatio } from './stats';

export const GRADUATION_MIN_DAYS = 56;
export const GRADUATION_MIN_SCORE = 4.0;
export const GRADUATION_MIN_RATE = 0.8;

/** 4問の平均。丸めない（表示時だけ小数1桁） */
export function automaticityScore(check: Pick<WeeklyCheck, 'automaticity'>): number {
  return check.automaticity.reduce((s, v) => s + v, 0) / check.automaticity.length;
}

/** 開始から56日以上、直近3回のスコアがすべて4.0以上、直近28日の割合0.8以上 */
export function graduationEligible(
  habit: Habit,
  logs: readonly HabitLog[],
  checks: readonly WeeklyCheck[],
  today: LocalDate,
): boolean {
  if (diffDays(today, habit.startedOn) < GRADUATION_MIN_DAYS) return false;
  const recent = checks
    .filter((c) => c.habitId === habit.id)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0))
    .slice(0, 3);
  if (recent.length < 3 || recent.some((c) => automaticityScore(c) < GRADUATION_MIN_SCORE)) return false;
  const r = recentRatio(habit, logs, today, 28);
  return r.rate !== null && r.rate >= GRADUATION_MIN_RATE;
}
