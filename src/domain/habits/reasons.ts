// 理由の促し（§8.2.4）
import { addDays } from '../dates';
import type { Habit, HabitLog, ID, LocalDate } from '../types';
import { isScheduled } from './schedule';

export interface ReasonPrompt {
  habitId: ID;
  date: LocalDate;
}

/** active な習慣について、today-3〜today-1 の予定日で記録がない日を古い順に返す */
export function pendingReasonPrompts(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  today: LocalDate,
): ReasonPrompt[] {
  const logged = new Set(logs.map((l) => `${l.habitId}|${l.date}`));
  const out: ReasonPrompt[] = [];
  for (let back = 3; back >= 1; back--) {
    const date = addDays(today, -back);
    for (const h of habits) {
      if (h.status !== 'active') continue;
      if (isScheduled(h, date) && !logged.has(`${h.id}|${date}`)) out.push({ habitId: h.id, date });
    }
  }
  return out;
}
