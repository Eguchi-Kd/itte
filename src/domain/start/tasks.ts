// やること（§8.3）【着】
import { logicalDate } from '../dates';
import type { ID, LocalDate, Session, Task } from '../types';

export interface TodayTasks {
  task: Task | null;
  others: Task[];
}

const byCreated = (a: Task, b: Task) => a.createdAt - b.createdAt;

/** plannedFor === today かつ未片づけのうち createdAt が最も古い1件。残りは others */
export function todayTask(tasks: readonly Task[], today: LocalDate): TodayTasks {
  const list = tasks.filter((t) => t.plannedFor === today && t.archivedAt === null).sort(byCreated);
  return { task: list[0] ?? null, others: list.slice(1) };
}

/** 予定日が今日より前で、片づけていないやること（D29） */
export function carryOverCandidates(tasks: readonly Task[], today: LocalDate): Task[] {
  return tasks.filter((t) => t.plannedFor < today && t.archivedAt === null).sort(byCreated);
}

/** その論理日に、そのやることのセッションが1件以上始まったか */
export function startedOn(task: Pick<Task, 'id'>, sessions: readonly Session[], date: LocalDate): boolean {
  return sessions.some((s) => s.taskId === task.id && logicalDate(s.startedAt) === date);
}

export interface TaskInput {
  title: string;
  roughVersion: string | null;
  firstAction: string | null;
  plannedFor: LocalDate;
  goalId?: ID | null;
  boardItemId?: ID | null;
}

export type TaskField = 'title' | 'roughVersion' | 'firstAction' | 'plannedFor';
export type TaskErrors = Partial<Record<TaskField, { copyKey: string; n?: number }>>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function textError(v: string | null, required: boolean): { copyKey: string; n?: number } | undefined {
  const len = (v ?? '').trim().length;
  if (required && len === 0) return { copyKey: 'errors.required' };
  if (len > 80) return { copyKey: 'errors.tooLong', n: 80 };
  return undefined;
}

/**
 * ラフ登録の検証（§6.6.1）。roughStart（B 条件）なら3項目すべて必須、A 条件では title だけ
 */
export function validateTaskInput(input: TaskInput, roughStart: boolean): TaskErrors {
  const e: TaskErrors = {};
  const title = textError(input.title, true);
  if (title) e.title = title;
  if (roughStart) {
    const rough = textError(input.roughVersion, true);
    if (rough) e.roughVersion = rough;
    const first = textError(input.firstAction, true);
    if (first) e.firstAction = first;
  }
  if (!DATE_RE.test(input.plannedFor)) e.plannedFor = { copyKey: 'errors.required' };
  return e;
}
