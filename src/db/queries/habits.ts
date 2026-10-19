import { addDays, dayStart } from '../../domain/dates';
import type { Candidate, Countermeasure, Habit, HabitLog, LocalDate, Move, ReasonTag, Session, Task, WeeklyCheck } from '../../domain/types';
import { db } from '../db';

export interface HomeData {
  habits: Habit[];
  logs: HabitLog[];
  tags: ReasonTag[];
  /** 未片づけで予定日が今日以前のやること */
  tasks: Task[];
  /** 前日の論理日の始まり以降に始まったセッション */
  sessions: Session[];
  /** 着手モジュールを使ったことがある */
  startUsed: boolean;
  /** 習慣・やること・段・手のどれかが1件以上ある（ホームの空の状態の判定） */
  hasRecords: boolean;
  /** 作成から7日以内の手と、その候補 */
  moves: Move[];
  candidates: Candidate[];
  /** 今日の 1日のしめがある */
  dailyDone: boolean;
}

/** ホーム用: すべての習慣、today-7 以降の記録、理由タグ（並び順）、今日までのやること、最近のセッション */
export async function queryHomeData(today: LocalDate): Promise<HomeData> {
  const [habits, logs, tags, tasks, sessions, taskCount, sessionCount, daily, moves, moveCount, goalCount] = await Promise.all([
    db.habits.toArray(),
    db.habitLogs.where('date').aboveOrEqual(addDays(today, -7)).toArray(),
    db.reasonTags.orderBy('order').toArray(),
    db.tasks.where('plannedFor').belowOrEqual(today).toArray(),
    db.sessions.where('startedAt').aboveOrEqual(dayStart(addDays(today, -1))).toArray(),
    db.tasks.count(),
    db.sessions.count(),
    db.dailyChecks.get(today),
    db.moves.where('createdAt').aboveOrEqual(dayStart(addDays(today, -6))).toArray(),
    db.moves.count(),
    db.goals.count(),
  ]);
  const candidates = await db.candidates.where('moveId').anyOf(moves.map((m) => m.id)).toArray();
  return {
    habits,
    logs,
    tags,
    tasks: tasks.filter((t) => t.archivedAt === null),
    sessions,
    startUsed: taskCount > 0 || sessionCount > 0,
    dailyDone: daily !== undefined,
    hasRecords: habits.length > 0 || taskCount > 0 || moveCount > 0 || goalCount > 0,
    moves,
    candidates,
  };
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
