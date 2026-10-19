// 着手のリポジトリ（§7.6）【着】
import { DomainError } from '../../domain/errors';
import { findAbandoned, transition, type SessionEffects } from '../../domain/start/session';
import { validateTaskInput, type TaskInput } from '../../domain/start/tasks';
import type {
  AffectActual,
  AffectPredictionValue,
  DailyCheck,
  EpochMs,
  EscapeLog,
  ID,
  LocalDate,
  Prediction,
  Session,
  StuckChoice,
  Task,
} from '../../domain/types';
import { db } from '../db';
import { appendImmutable } from '../ledger';
import { assertCanPredict } from './goals';
import { logicalDate } from '../../domain/dates';

const newId = () => crypto.randomUUID();

function trimOrNull(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  return t === '' ? null : t;
}

async function requireTask(id: ID): Promise<Task> {
  const t = await db.tasks.get(id);
  if (!t) throw new DomainError('NOT_FOUND', 'errors.notFound', { id });
  return t;
}

async function requireSession(id: ID): Promise<Session> {
  const s = await db.sessions.get(id);
  if (!s) throw new DomainError('NOT_FOUND', 'errors.notFound', { id });
  return s;
}

/** B 条件（roughStart=true）は3項目必須、A 条件は title のみで roughVersion と firstAction は null */
export async function createTask(input: TaskInput, roughStart: boolean, now: EpochMs): Promise<Task> {
  const errors = validateTaskInput(input, roughStart);
  if (Object.keys(errors).length > 0) throw new DomainError('VALIDATION', 'errors.required', errors);
  const task: Task = {
    id: newId(),
    title: input.title.trim(),
    roughVersion: roughStart ? trimOrNull(input.roughVersion) : null,
    firstAction: roughStart ? trimOrNull(input.firstAction) : null,
    nextStep: null,
    plannedFor: input.plannedFor,
    planHistory: [],
    boardItemId: input.boardItemId ?? null,
    goalId: input.goalId ?? null,
    createdAt: now,
    archivedAt: null,
    closedReason: null,
  };
  await db.tasks.add(task);
  return task;
}

export async function updateTask(
  id: ID,
  patch: Partial<Pick<Task, 'title' | 'roughVersion' | 'firstAction' | 'nextStep' | 'plannedFor' | 'goalId' | 'boardItemId'>>,
  _now: EpochMs,
): Promise<Task> {
  return db.transaction('rw', db.tasks, async () => {
    const t = await requireTask(id);
    const next: Task = { ...t, ...patch };
    if (next.title.trim().length < 1 || next.title.length > 80) throw new DomainError('VALIDATION', 'errors.required');
    await db.tasks.put(next);
    return next;
  });
}

/** 持ち越し（D29）。元の予定日を planHistory に残し、plannedFor を今日にする */
export async function carryOverTask(id: ID, today: LocalDate, _now: EpochMs): Promise<Task> {
  return db.transaction('rw', db.tasks, async () => {
    const t = await requireTask(id);
    if (t.plannedFor === today) return t;
    const next: Task = { ...t, planHistory: [...t.planHistory, t.plannedFor], plannedFor: today };
    await db.tasks.put(next);
    return next;
  });
}

/** 片づける（D30） */
export async function closeTask(id: ID, reason: 'done' | 'dropped', now: EpochMs): Promise<Task> {
  return db.transaction('rw', db.tasks, async () => {
    const t = await requireTask(id);
    const next: Task = { ...t, archivedAt: now, closedReason: reason };
    await db.tasks.put(next);
    return next;
  });
}

async function apply(effects: SessionEffects): Promise<void> {
  if (effects.close) {
    const { id, endedAt, outcome } = effects.close;
    await db.sessions.update(id, { endedAt, outcome });
  }
  if (effects.create) await db.sessions.add(effects.create);
  if (effects.stuckLog) await db.stuckLogs.add(effects.stuckLog);
  if (effects.nextStep) await db.tasks.update(effects.nextStep.taskId, { nextStep: effects.nextStep.value });
}

/**
 * セッションを始める。進行中のセッションがあれば stopped で閉じてから作る。
 * affect があれば AFFECT 予想を追記する（段に紐づいたやることのとき）
 */
export async function startSession(
  taskId: ID,
  roughMode: boolean,
  affect: AffectPredictionValue | null,
  now: EpochMs,
): Promise<Session> {
  return db.transaction('rw', [db.tasks, db.sessions, db.goals, db.judgments, db.predictions, db.ledger], async () => {
    const task = await requireTask(taskId);
    // 予想は段が OPEN で判定がなく期限内のときだけ（I5）
    if (affect && task.goalId) await assertCanPredict(task.goalId, logicalDate(now));
    const open = (await db.sessions.toArray()).filter((s) => s.endedAt === null);
    for (const s of open) await db.sessions.update(s.id, { endedAt: now, outcome: 'stopped' });

    const sessionId = newId();
    let affectPredictionId: ID | null = null;
    if (affect && task.goalId) {
      const prediction: Prediction = {
        id: newId(),
        goalId: task.goalId,
        kind: 'AFFECT',
        value: affect,
        predictedAt: now,
        sessionId,
      };
      await appendImmutable('predictions', prediction, now);
      affectPredictionId = prediction.id;
    }
    const effects = transition(null, { type: 'start', taskId, roughMode, affectPredictionId }, now, () => sessionId);
    await apply(effects);
    return effects.create as Session;
  });
}

/** 詰まりを記録する。stop なら Session を stopped にする */
export async function recordStuck(sessionId: ID, blocker: string, choice: StuckChoice, now: EpochMs): Promise<SessionEffects> {
  const b = blocker.trim();
  if (b.length < 1) throw new DomainError('VALIDATION', 'errors.required');
  if (b.length > 80) throw new DomainError('VALIDATION', 'errors.tooLong', { n: 80 });
  return db.transaction('rw', [db.sessions, db.stuckLogs, db.tasks], async () => {
    const s = await requireSession(sessionId);
    const effects = transition(s, { type: 'stuck', choice, blocker: b }, now, newId);
    await apply(effects);
    return effects;
  });
}

export async function interruptSession(sessionId: ID, now: EpochMs): Promise<void> {
  await db.transaction('rw', [db.sessions, db.tasks], async () => {
    const s = await requireSession(sessionId);
    await apply(transition(s, { type: 'interrupt' }, now, newId));
  });
}

export interface AffectActualInput {
  intensity: number;
  durationMin: number;
}

/**
 * §8.4.2 の終了。continue は新しいセッションを作り、その ID を返す。
 * stop は次の一手を更新する（B 条件のセッションでは必須、1〜80文字）
 */
export async function endSession(
  sessionId: ID,
  choice: 'continue' | 'stop',
  nextStep: string | null,
  affectActual: AffectActualInput | null,
  now: EpochMs,
): Promise<ID | null> {
  return db.transaction('rw', [db.sessions, db.tasks, db.stuckLogs, db.affectActuals, db.ledger], async () => {
    const s = await requireSession(sessionId);
    if (affectActual && s.affectPredictionId) {
      const exists = await db.affectActuals.where('predictionId').equals(s.affectPredictionId).count();
      if (exists === 0) {
        const actual: AffectActual = { id: newId(), predictionId: s.affectPredictionId, ...affectActual, at: now };
        await appendImmutable('affectActuals', actual, now);
      }
    }
    if (choice === 'continue') {
      const effects = transition(s, { type: 'continue' }, now, newId);
      await apply(effects);
      return effects.create?.id ?? null;
    }
    const step = trimOrNull(nextStep);
    if (s.roughMode && !step) throw new DomainError('VALIDATION', 'errors.required', { field: 'nextStep' });
    if (step && step.length > 80) throw new DomainError('VALIDATION', 'errors.tooLong', { n: 80 });
    await apply(transition(s, { type: 'stop', nextStep: step }, now, newId));
    return null;
  });
}

/** 放置セッションを abandoned で閉じ、閉じた ID を古い順に返す（§8.4.3） */
export async function sweepAbandoned(now: EpochMs): Promise<ID[]> {
  return db.transaction('rw', db.sessions, async () => {
    const targets = findAbandoned(await db.sessions.toArray(), now);
    for (const s of targets) {
      const e = transition(s, { type: 'abandon' }, now, newId);
      if (e.close) await db.sessions.update(s.id, { endedAt: e.close.endedAt, outcome: e.close.outcome });
    }
    return targets.map((s) => s.id);
  });
}

export type EscapeInput = Omit<EscapeLog, 'id' | 'at'>;

/** 逃避ログ。全項目 null 可 */
export async function saveEscapeLog(input: Partial<EscapeInput>, now: EpochMs): Promise<EscapeLog> {
  const log: EscapeLog = {
    id: newId(),
    at: now,
    taskId: input.taskId ?? null,
    sessionId: input.sessionId ?? null,
    priorState: input.priorState ?? null,
    target: input.target ?? null,
    enjoyed: input.enjoyed ?? null,
  };
  await db.escapeLogs.add(log);
  return log;
}

export type DailyInput = Pick<DailyCheck, 'pendingWorry' | 'consumptionMin' | 'plannedTaskExists'>;

/** 1日のしめ。同じ論理日は上書き。consumptionMin は 0〜1440 の整数（I18） */
export async function saveDailyCheck(input: DailyInput, today: LocalDate, now: EpochMs): Promise<DailyCheck> {
  const m = input.consumptionMin;
  if (!Number.isInteger(m) || m < 0 || m > 1440) {
    throw new DomainError('VALIDATION', 'errors.consumption', { consumptionMin: m });
  }
  const check: DailyCheck = { date: today, ...input, answeredAt: now };
  await db.dailyChecks.put(check);
  return check;
}
