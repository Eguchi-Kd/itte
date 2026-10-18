// 定期レビュー（§8.2.7）
import { diffDays, logicalDate } from '../dates';
import type { Habit, LocalDate, Persona, WeeklyCheck } from '../types';

/** 間隔は既定28日、meaning なら14日 */
export function reviewInterval(persona: Persona | null): number {
  return persona === 'meaning' ? 14 : 28;
}

/** 開始から d 日以上たち、habitReview 付きの週次チェックが直近 d 日以内にないとき true */
export function reviewDue(
  habit: Habit,
  checks: readonly WeeklyCheck[],
  today: LocalDate,
  persona: Persona | null,
): boolean {
  const d = reviewInterval(persona);
  if (diffDays(today, habit.startedOn) < d) return false;
  return !checks.some(
    (c) => c.habitId === habit.id && c.habitReview !== null && diffDays(today, logicalDate(c.answeredAt)) < d,
  );
}
