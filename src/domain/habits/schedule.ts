// 予定日（§8.2.1）
import { addDays, weekdayOf } from '../dates';
import type { Habit, LocalDate } from '../types';

export function isScheduled(habit: Pick<Habit, 'schedule' | 'startedOn' | 'endedOn'>, date: LocalDate): boolean {
  if (date < habit.startedOn) return false;
  if (habit.endedOn !== null && date > habit.endedOn) return false;
  return habit.schedule.days.includes(weekdayOf(date));
}

/** 期間内の予定日（古い順、両端を含む） */
export function scheduledDates(
  habit: Pick<Habit, 'schedule' | 'startedOn' | 'endedOn'>,
  from: LocalDate,
  to: LocalDate,
): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isScheduled(habit, d)) out.push(d);
  return out;
}
