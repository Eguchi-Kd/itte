import { addDays } from '../../domain/dates';
import type { Countermeasure, Habit, HabitLog, LocalDate, ReasonTag, WeeklyCheck } from '../../domain/types';
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

export interface HabitDetailData {
  habit: Habit | null;
  logs: HabitLog[];
  checks: WeeklyCheck[];
  countermeasures: Countermeasure[];
  tags: ReasonTag[];
}

export async function queryHabitDetail(id: string): Promise<HabitDetailData> {
  const [habit, logs, checks, countermeasures, tags] = await Promise.all([
    db.habits.get(id),
    db.habitLogs.where('habitId').equals(id).toArray(),
    db.weeklyChecks.where('habitId').equals(id).toArray(),
    db.countermeasures.where('habitId').equals(id).toArray(),
    db.reasonTags.toArray(),
  ]);
  return { habit: habit ?? null, logs, checks, countermeasures, tags };
}

/** 一覧用: すべての習慣と、today-28 以降の記録 */
export async function queryHabitList(today: LocalDate): Promise<{ habits: Habit[]; logs: HabitLog[] }> {
  const [habits, logs] = await Promise.all([
    db.habits.orderBy('startedOn').toArray(),
    db.habitLogs.where('date').aboveOrEqual(addDays(today, -28)).toArray(),
  ]);
  return { habits, logs };
}
