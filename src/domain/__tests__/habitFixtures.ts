import { addDays } from '../dates';
import type { Habit, HabitLog, WeeklyCheck } from '../types';

export const TODAY = '2026-10-18'; // 日曜

export function habit(p: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    kind: 'build',
    name: '英単語',
    replacesText: null,
    purpose: '',
    unit: '分',
    amount: 10,
    minAmount: 2,
    amountChangedOn: '2026-08-01',
    schedule: { days: [0, 1, 2, 3, 4, 5, 6], time: '07:00', cue: null },
    place: '机',
    how: '',
    commitmentNote: null,
    funNote: null,
    status: 'active',
    startedOn: '2026-08-01',
    endedOn: null,
    endNote: null,
    createdAt: 0,
    ...p,
  };
}

let seq = 0;
export function log(date: string, done = true, p: Partial<HabitLog> = {}): HabitLog {
  seq += 1;
  return {
    id: `l${seq}`,
    habitId: 'h1',
    date,
    done,
    amount: done ? 10 : 0,
    reasonTagIds: [],
    memo: null,
    recordedAt: 0,
    ...p,
  };
}

/** from〜to の各日に、isDone が true なら done、false なら記録なし（ログを作らない） */
export function logsBy(from: string, to: string, isDone: (d: string) => boolean, habitId = 'h1'): HabitLog[] {
  const out: HabitLog[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isDone(d)) out.push(log(d, true, { habitId }));
  return out;
}

export function check(weekStart: string, scores: [number, number, number, number], p: Partial<WeeklyCheck> = {}): WeeklyCheck {
  return {
    id: `c-${weekStart}`,
    habitId: 'h1',
    weekStart,
    automaticity: scores,
    habitReview: null,
    answeredAt: new Date(`${weekStart}T12:00:00`).getTime(),
    ...p,
  };
}
