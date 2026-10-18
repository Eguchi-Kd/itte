// 統計（§8.2.2）。連続日数の関数は作らない（D2）
import { addDays, inRange, weekStartOf } from '../dates';
import type { Habit, HabitLog, LocalDate } from '../types';
import { scheduledDates } from './schedule';

export interface DoneRatio {
  rate: number | null;
  done: number;
  scheduled: number;
}

function logsOf(habit: Pick<Habit, 'id'>, logs: readonly HabitLog[]): HabitLog[] {
  return logs.filter((l) => l.habitId === habit.id);
}

/** 分母は期間内の予定日。今日が予定日で記録がなければ分母に入れない */
export function doneRatio(
  habit: Habit,
  logs: readonly HabitLog[],
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
): DoneRatio {
  const byDate = new Map(logsOf(habit, logs).map((l) => [l.date, l]));
  let done = 0;
  let scheduled = 0;
  for (const d of scheduledDates(habit, from, to)) {
    const log = byDate.get(d);
    if (d === today && !log) continue;
    scheduled += 1;
    if (log?.done) done += 1;
  }
  return { rate: scheduled === 0 ? null : done / scheduled, done, scheduled };
}

/** 直近 n 日（today を含む）の doneRatio */
export function recentRatio(habit: Habit, logs: readonly HabitLog[], today: LocalDate, days: number): DoneRatio {
  return doneRatio(habit, logs, addDays(today, -(days - 1)), today, today);
}

/** done=true の記録の amount 合計（予定外の日も含む） */
export function cumulativeAmount(habit: Pick<Habit, 'id'>, logs: readonly HabitLog[]): number {
  return logsOf(habit, logs)
    .filter((l) => l.done)
    .reduce((s, l) => s + l.amount, 0);
}

export interface WeekPoint {
  weekStart: LocalDate;
  doneCount: number;
  scheduledCount: number;
  amount: number;
}

/** 週ごとの実行回数・予定回数・量（古い順）。今週は today までを数える */
export function weeklySeries(habit: Habit, logs: readonly HabitLog[], today: LocalDate, weeks = 12): WeekPoint[] {
  const own = logsOf(habit, logs);
  const thisWeek = weekStartOf(today);
  const out: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    const we = addDays(ws, 6);
    const inWeek = own.filter((l) => l.done && inRange(l.date, ws, we) && l.date <= today);
    out.push({
      weekStart: ws,
      doneCount: inWeek.length,
      scheduledCount: scheduledDates(habit, ws, we).length,
      amount: inWeek.reduce((s, l) => s + l.amount, 0),
    });
  }
  return out;
}

/** その週の予定回数と、予定日のうち記録した回数（ホームの「今週 {done}/{scheduled} 回」） */
export function weekCount(habit: Habit, logs: readonly HabitLog[], today: LocalDate): { done: number; scheduled: number } {
  const ws = weekStartOf(today);
  const we = addDays(ws, 6);
  const dates = scheduledDates(habit, ws, we);
  const doneDates = new Set(logsOf(habit, logs).filter((l) => l.done).map((l) => l.date));
  return { done: dates.filter((d) => doneDates.has(d)).length, scheduled: dates.length };
}

