import type { BoardItem, Goal, Session, StuckLog, Task } from '../../domain/types';
import { db } from '../db';

export interface TaskDetailData {
  task: Task | null;
  sessions: Session[];
  stuckLogs: StuckLog[];
  goal: Goal | null;
  boardItem: BoardItem | null;
}

export async function queryTaskDetail(id: string): Promise<TaskDetailData> {
  const task = (await db.tasks.get(id)) ?? null;
  const [sessions, stuckLogs, goal, boardItem] = await Promise.all([
    db.sessions.where('taskId').equals(id).toArray(),
    db.stuckLogs.where('taskId').equals(id).toArray(),
    task?.goalId ? db.goals.get(task.goalId) : undefined,
    task?.boardItemId ? db.boardItems.get(task.boardItemId) : undefined,
  ]);
  return {
    task,
    sessions: sessions.sort((a, b) => b.startedAt - a.startedAt),
    stuckLogs: stuckLogs.sort((a, b) => b.at - a.at),
    goal: goal ?? null,
    boardItem: boardItem ?? null,
  };
}

export function queryTasks(): Promise<Task[]> {
  return db.tasks.orderBy('plannedFor').toArray();
}

export function querySession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

/** 段のチップ用: 判定前（OPEN）で非表示でない段 */
export async function queryOpenGoals(): Promise<Goal[]> {
  return (await db.goals.where('status').equals('OPEN').toArray()).filter((g) => g.hiddenAt === null);
}

export function queryBoardItem(id: string): Promise<BoardItem | undefined> {
  return db.boardItems.get(id);
}
