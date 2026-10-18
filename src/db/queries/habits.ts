import { addDays } from '../../domain/dates';
import type { Habit, HabitLog, LocalDate, ReasonTag } from '../../domain/types';
import { db } from '../db';

export interface HomeData {
  habits: Habit[];
  logs: HabitLog[];
  tags: ReasonTag[];
}

/** ホーム用: すべての習慣、today-7 以降の記録、理由タグ（並び順） */
export async function queryHomeData(today: LocalDate): Promise<HomeData> {
  const [habits, logs, tags] = await Promise.all([
    db.habits.toArray(),
    db.habitLogs.where('date').aboveOrEqual(addDays(today, -7)).toArray(),
    db.reasonTags.orderBy('order').toArray(),
  ]);
  return { habits, logs, tags };
}

export function queryHabit(id: string): Promise<Habit | undefined> {
  return db.habits.get(id);
}

export function queryHabitLogs(habitId: string): Promise<HabitLog[]> {
  return db.habitLogs.where('habitId').equals(habitId).toArray();
}
