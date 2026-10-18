// 習慣のリポジトリ（§7.6）【仕】
import { diffDays, logicalDate } from '../../domain/dates';
import { DomainError } from '../../domain/errors';
import { normalizeHabitDraft, validateHabitDraft, type HabitDraft } from '../../domain/habits/validate';
import type {
  Countermeasure,
  EpochMs,
  Habit,
  HabitLog,
  HabitStatus,
  ID,
  LocalDate,
  ReasonTag,
  WeeklyCheck,
} from '../../domain/types';
import { db } from '../db';

/** 記録できる日付は今日と過去3日（論理日）。未来日と4日以上前は拒否（I14） */
export function assertLogWindow(date: LocalDate, now: EpochMs): void {
  const back = diffDays(logicalDate(now), date);
  if (back < 0 || back > 3) throw new DomainError('OUT_OF_WINDOW', 'errors.outOfWindow', { date });
}

async function requireHabit(habitId: ID): Promise<Habit> {
  const h = await db.habits.get(habitId);
  if (!h) throw new DomainError('NOT_FOUND', 'errors.notFound', { habitId });
  return h;
}

function findLog(habitId: ID, date: LocalDate): Promise<HabitLog | undefined> {
  return db.habitLogs.where('[habitId+date]').equals([habitId, date]).first();
}

export interface LogChange {
  log: HabitLog;
  /** 変更前の記録。取り消しで元に戻すために使う */
  previous: HabitLog | null;
}

/** その日の記録を done=true にする。既に done=true なら amount を加算する（追加実行） */
export async function recordDone(
  habitId: ID,
  date: LocalDate,
  amount: number | undefined,
  now: EpochMs,
): Promise<LogChange> {
  assertLogWindow(date, now);
  return db.transaction('rw', db.habits, db.habitLogs, async () => {
    const habit = await requireHabit(habitId);
    const add = amount ?? habit.amount;
    if (!Number.isInteger(add) || add < 1) throw new DomainError('VALIDATION', 'errors.positiveInt', { amount });
    const previous = (await findLog(habitId, date)) ?? null;
    const log: HabitLog = previous
      ? {
          ...previous,
          done: true,
          amount: previous.done ? previous.amount + add : add,
          reasonTagIds: [],
          recordedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          habitId,
          date,
          done: true,
          amount: add,
          reasonTagIds: [],
          memo: null,
          recordedAt: now,
        };
    await db.habitLogs.put(log);
    return { log, previous };
  });
}

/** その日の記録を消す */
export async function undoLog(habitId: ID, date: LocalDate, now: EpochMs): Promise<HabitLog | null> {
  assertLogWindow(date, now);
  return db.transaction('rw', db.habitLogs, async () => {
    const previous = (await findLog(habitId, date)) ?? null;
    if (previous) await db.habitLogs.delete(previous.id);
    return previous;
  });
}

/** 取り消し用: その日の記録を変更前の状態（なければ記録なし＝削除）に戻す */
export async function revertLog(habitId: ID, date: LocalDate, previous: HabitLog | null, now: EpochMs): Promise<void> {
  assertLogWindow(date, now);
  await db.transaction('rw', db.habitLogs, async () => {
    const current = await findLog(habitId, date);
    if (current && (!previous || current.id !== previous.id)) await db.habitLogs.delete(current.id);
    if (previous) await db.habitLogs.put(previous);
  });
}

/** 記録なし（理由タグ）を残す */
export async function recordMissed(
  habitId: ID,
  date: LocalDate,
  reasonTagIds: ID[],
  memo: string | null,
  now: EpochMs,
): Promise<LogChange> {
  assertLogWindow(date, now);
  return db.transaction('rw', db.habits, db.habitLogs, async () => {
    await requireHabit(habitId);
    const previous = (await findLog(habitId, date)) ?? null;
    const log: HabitLog = {
      id: previous?.id ?? crypto.randomUUID(),
      habitId,
      date,
      done: false,
      amount: 0,
      reasonTagIds: [...new Set(reasonTagIds)],
      memo: memo?.trim() ? memo.trim() : null,
      recordedAt: now,
    };
    await db.habitLogs.put(log);
    return { log, previous };
  });
}

/** 作成・更新。amount が変わったら amountChangedOn を今日にする */
export async function saveHabit(input: HabitDraft & { id?: ID }, now: EpochMs): Promise<Habit> {
  const today = logicalDate(now);
  return db.transaction('rw', db.habits, db.settings, async () => {
    const persona = (await db.settings.get('singleton'))?.persona ?? null;
    const draft = normalizeHabitDraft(input);
    const errors = validateHabitDraft(draft, persona);
    if (Object.keys(errors).length > 0) throw new DomainError('VALIDATION', 'errors.required', errors);

    const existing = input.id ? await db.habits.get(input.id) : undefined;
    if (input.id && !existing) throw new DomainError('NOT_FOUND', 'errors.notFound', { id: input.id });
    const habit: Habit = existing
      ? {
          ...existing,
          ...draft,
          amountChangedOn: draft.amount !== existing.amount ? today : existing.amountChangedOn,
        }
      : {
          ...draft,
          id: crypto.randomUUID(),
          amountChangedOn: today,
          status: 'active',
          startedOn: today,
          endedOn: null,
          endNote: null,
          createdAt: now,
        };
    await db.habits.put(habit);
    return habit;
  });
}

/** graduated／ended で endedOn を今日に。active に戻すと endedOn を消す */
export async function setHabitStatus(habitId: ID, status: HabitStatus, note: string | null, now: EpochMs): Promise<Habit> {
  return db.transaction('rw', db.habits, async () => {
    const habit = await requireHabit(habitId);
    const next: Habit =
      status === 'active'
        ? { ...habit, status, endedOn: null, endNote: null }
        : { ...habit, status, endedOn: logicalDate(now), endNote: note?.trim() ? note.trim() : null };
    await db.habits.put(next);
    return next;
  });
}

export type WeeklyCheckInput = Omit<WeeklyCheck, 'id' | 'answeredAt'>;

/** 1習慣1週1件の upsert（I15）。decision='end' なら習慣を終了する */
export async function saveWeeklyCheck(input: WeeklyCheckInput, now: EpochMs): Promise<WeeklyCheck> {
  if (input.automaticity.some((v) => !Number.isInteger(v) || v < 1 || v > 5)) {
    throw new DomainError('VALIDATION', 'errors.required', { automaticity: input.automaticity });
  }
  return db.transaction('rw', db.habits, db.weeklyChecks, async () => {
    await requireHabit(input.habitId);
    const existing = await db.weeklyChecks
      .where('[habitId+weekStart]')
      .equals([input.habitId, input.weekStart])
      .first();
    const check: WeeklyCheck = { ...input, id: existing?.id ?? crypto.randomUUID(), answeredAt: now };
    await db.weeklyChecks.put(check);
    if (input.habitReview?.decision === 'end') await setHabitStatus(input.habitId, 'ended', null, now);
    return check;
  });
}

export async function saveCountermeasure(
  input: Omit<Countermeasure, 'id' | 'createdOn'> & { id?: ID },
  now: EpochMs,
): Promise<Countermeasure> {
  const action = input.action.trim();
  if (action.length < 1 || action.length > 80) throw new DomainError('VALIDATION', 'errors.required', { action });
  return db.transaction('rw', db.countermeasures, async () => {
    const existing = input.id ? await db.countermeasures.get(input.id) : undefined;
    const cm: Countermeasure = {
      ...input,
      action,
      id: existing?.id ?? crypto.randomUUID(),
      createdOn: existing?.createdOn ?? logicalDate(now),
    };
    await db.countermeasures.put(cm);
    return cm;
  });
}

/** 理由タグの追加・名前変更・非表示 */
export async function saveReasonTag(input: Partial<ReasonTag> & { label: string }): Promise<ReasonTag> {
  const label = input.label.trim();
  if (label.length < 1 || label.length > 12) throw new DomainError('VALIDATION', 'errors.tooLong', { n: 12 });
  return db.transaction('rw', db.reasonTags, async () => {
    const existing = input.id ? await db.reasonTags.get(input.id) : undefined;
    const order = existing?.order ?? (await db.reasonTags.count());
    const tag: ReasonTag = {
      id: existing?.id ?? crypto.randomUUID(),
      label,
      builtIn: existing?.builtIn ?? false,
      archived: input.archived ?? existing?.archived ?? false,
      order: input.order ?? order,
    };
    await db.reasonTags.put(tag);
    return tag;
  });
}
