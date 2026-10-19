// 段のリポジトリ（§7.6）【刻】。追記専用テーブルへの追加は必ず appendImmutable を通す
import { addDays, dayStart, logicalDate } from '../../domain/dates';
import { DomainError } from '../../domain/errors';
import { dueGoals } from '../../domain/goals/deadlines';
import { goalErrorCopyKey, goalInputErrors, metricInputSchema, type GoalInput, type MetricInput } from '../../domain/goals/goal';
import { computeOutcome, unmetDetailValid, type UnmetDetail } from '../../domain/goals/judgment';
import { detectStalls } from '../../domain/goals/stall';
import type {
  AffectActual,
  AffectPredictionValue,
  Commitment,
  DeadlineExtension,
  EpochMs,
  FollowUpChoice,
  Goal,
  GoalFollowUp,
  ID,
  Judgment,
  JudgmentCorrection,
  JudgmentRequest,
  LocalDate,
  Measurement,
  Metric,
  OutcomePredictionValue,
  Prediction,
  StallFlag,
} from '../../domain/types';
import { db } from '../db';
import { appendImmutable } from '../ledger';
import { defaultSettings } from '../seed';

const newId = () => crypto.randomUUID();

async function requireGoal(id: ID): Promise<Goal> {
  const g = await db.goals.get(id);
  if (!g) throw new DomainError('NOT_FOUND', 'errors.notFound', { id });
  return g;
}

/** 指標を登録する。取得方法が空なら VALIDATION */
export async function saveMetric(input: MetricInput & { id?: ID }, now: EpochMs): Promise<Metric> {
  const r = metricInputSchema.safeParse(input);
  if (!r.success) throw new DomainError('VALIDATION', 'errors.required', r.error.issues);
  const existing = input.id ? await db.metrics.get(input.id) : undefined;
  const metric: Metric = { ...r.data, id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? now };
  await db.metrics.put(metric);
  return metric;
}

/** 実測を記録する（追記専用） */
export async function recordMeasurement(
  input: { metricId: ID; value: number; measuredAt: EpochMs; note: string | null },
  now: EpochMs,
): Promise<Measurement> {
  if (!Number.isFinite(input.value)) throw new DomainError('VALIDATION', 'errors.required', { field: 'value' });
  if (!(await db.metrics.get(input.metricId))) throw new DomainError('NOT_FOUND', 'errors.notFound', { metricId: input.metricId });
  const m: Measurement = {
    id: newId(),
    metricId: input.metricId,
    value: input.value,
    measuredAt: input.measuredAt,
    source: 'manual',
    note: input.note?.trim() ? input.note.trim() : null,
    createdAt: now,
  };
  return appendImmutable('measurements', m, now);
}

const GOAL_TABLES = () => [db.goals, db.metrics, db.commitments, db.predictions, db.ledger];

/** 段・事前コミット2件・OUTCOME 予想1件を1トランザクションで作る（I1, I4, I5） */
async function insertGoal(input: GoalInput, links: Pick<Goal, 'parentId' | 'recutOfId'>, now: EpochMs): Promise<Goal> {
  const today = logicalDate(now);
  const errors = goalInputErrors(input, today);
  if (errors.length > 0) throw new DomainError('VALIDATION', goalErrorCopyKey(errors), errors);
  if (!(await db.metrics.get(input.metricId))) throw new DomainError('VALIDATION', 'errors.required', ['metricId']);
  const goal: Goal = {
    id: newId(),
    parentId: links.parentId,
    recutOfId: links.recutOfId,
    metricId: input.metricId,
    title: input.title.trim(),
    targetValue: input.targetValue,
    comparator: input.comparator,
    deadline: input.deadline,
    status: 'OPEN',
    createdAt: now,
    hiddenAt: null,
  };
  await db.goals.add(goal);
  const commitments: Commitment[] = [
    { id: newId(), goalId: goal.id, condition: 'ON_MET', nextAction: input.onMet.trim(), createdAt: now },
    { id: newId(), goalId: goal.id, condition: 'ON_UNMET', nextAction: input.onUnmet.trim(), createdAt: now },
  ];
  for (const c of commitments) await appendImmutable('commitments', c, now);
  const value: OutcomePredictionValue = { probability: input.probability, value: input.predictedValue };
  const prediction: Prediction = { id: newId(), goalId: goal.id, kind: 'OUTCOME', value, predictedAt: now, sessionId: null };
  await appendImmutable('predictions', prediction, now);
  return goal;
}

export async function createGoal(input: GoalInput, now: EpochMs): Promise<Goal> {
  return db.transaction('rw', GOAL_TABLES(), () => insertGoal(input, { parentId: null, recutOfId: null }, now));
}

/** 刻む: 親が UNMET でなければ CONFLICT（I7） */
export async function createChildGoal(parentId: ID, input: GoalInput, now: EpochMs): Promise<Goal> {
  return db.transaction('rw', GOAL_TABLES(), async () => {
    const parent = await requireGoal(parentId);
    if (parent.status !== 'UNMET') throw new DomainError('CONFLICT', 'errors.parentOpen', { parentId });
    return insertGoal(input, { parentId: parent.id, recutOfId: null }, now);
  });
}

/** 切り直す: 元が UNMET でなければ CONFLICT。parentId は元の親、recutOfId は元 */
export async function createRecutGoal(goalId: ID, input: GoalInput, now: EpochMs): Promise<Goal> {
  return db.transaction('rw', GOAL_TABLES(), async () => {
    const original = await requireGoal(goalId);
    if (original.status !== 'UNMET') throw new DomainError('CONFLICT', 'errors.parentOpen', { goalId });
    return insertGoal(input, { parentId: original.parentId, recutOfId: original.id }, now);
  });
}

/** 期限の延長（I6）。OPEN かつ today <= deadline のときだけ。新しい期限は今の期限より後。理由必須 */
export async function extendDeadline(
  goalId: ID,
  newDeadline: LocalDate,
  reason: string,
  today: LocalDate,
  now: EpochMs,
): Promise<Goal> {
  const r = reason.trim();
  if (r.length < 1 || r.length > 200) throw new DomainError('VALIDATION', 'errors.required', { field: 'reason' });
  return db.transaction('rw', [db.goals, db.deadlineExtensions, db.ledger], async () => {
    const g = await requireGoal(goalId);
    if (g.status !== 'OPEN' || today > g.deadline) throw new DomainError('CONFLICT', 'errors.extendPast', { goalId });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDeadline) || newDeadline <= g.deadline) {
      throw new DomainError('VALIDATION', 'errors.deadlineFuture', { newDeadline });
    }
    const ext: DeadlineExtension = { id: newId(), goalId, previousDeadline: g.deadline, newDeadline, reason: r, createdAt: now };
    await appendImmutable('deadlineExtensions', ext, now);
    const next: Goal = { ...g, deadline: newDeadline };
    await db.goals.put(next);
    return next;
  });
}

/** 期限到来の検出（§8.7.3）。判定待ち（JudgmentRequest）を追記し、作ったものを返す */
export async function detectDueGoals(today: LocalDate, now: EpochMs): Promise<JudgmentRequest[]> {
  return db.transaction('rw', [db.goals, db.judgmentRequests, db.ledger], async () => {
    const created = dueGoals(await db.goals.toArray(), await db.judgmentRequests.toArray(), today, now);
    for (const r of created) await appendImmutable('judgmentRequests', r, now);
    return created;
  });
}

/**
 * 判定（I3, I8）。結果は computeOutcome で計算し、引数で受け取らない。
 * Measurement（source='judgment'）と Judgment を追記し、Goal の状態を更新する。1トランザクション
 */
export async function judge(
  goalId: ID,
  actualValue: number,
  unmetDetail: UnmetDetail | null,
  flags: { enforced: boolean },
  now: EpochMs,
): Promise<Judgment> {
  if (!Number.isFinite(actualValue)) throw new DomainError('VALIDATION', 'errors.required', { field: 'actualValue' });
  return db.transaction('rw', [db.goals, db.judgments, db.judgmentRequests, db.measurements, db.ledger], async () => {
    const g = await requireGoal(goalId);
    if ((await db.judgments.where('goalId').equals(goalId).count()) > 0) {
      throw new DomainError('CONFLICT', 'errors.alreadyJudged', { goalId });
    }
    if (g.status !== 'OPEN') throw new DomainError('CONFLICT', 'errors.alreadyJudged', { goalId });
    const today = logicalDate(now);
    if (g.deadline >= today) throw new DomainError('CONFLICT', 'errors.notDue', { goalId });
    const outcome = computeOutcome(g.comparator, g.targetValue, actualValue);
    if (outcome === 'UNMET' && !unmetDetailValid(unmetDetail)) {
      throw new DomainError('VALIDATION', 'errors.unmetDetail', { goalId });
    }
    // 判定待ちがまだなければ、期限日の翌日4:00 を要求時刻として作る（D33）
    let request = await db.judgmentRequests.get(goalId);
    if (!request) {
      request = { goalId, requestedAt: dayStart(addDays(g.deadline, 1)), detectedAt: now };
      await appendImmutable('judgmentRequests', request, now);
    }
    const measurement: Measurement = {
      id: newId(),
      metricId: g.metricId,
      value: actualValue,
      measuredAt: now,
      source: 'judgment',
      note: null,
      createdAt: now,
    };
    await appendImmutable('measurements', measurement, now);
    const j: Judgment = {
      id: newId(),
      goalId,
      outcome,
      actualValue,
      investedHours: outcome === 'UNMET' ? (unmetDetail?.investedHours ?? null) : null,
      costNote: outcome === 'UNMET' ? (unmetDetail?.costNote?.trim() ?? null) : null,
      requestedAt: request.requestedAt,
      detectedAt: request.detectedAt,
      judgedAt: now,
      enforced: flags.enforced,
    };
    await appendImmutable('judgments', j, now);
    await db.goals.update(goalId, { status: outcome });
    return j;
  });
}

/** 届かなかった段のあとの選択（刻む／切り直す／取り下げる）を追記する（一意、D35） */
export async function chooseFollowUp(goalId: ID, choice: FollowUpChoice, now: EpochMs): Promise<GoalFollowUp> {
  return db.transaction('rw', [db.goals, db.goalFollowUps, db.ledger], async () => {
    const g = await requireGoal(goalId);
    if (g.status !== 'UNMET') throw new DomainError('CONFLICT', 'errors.parentOpen', { goalId });
    if (await db.goalFollowUps.where('goalId').equals(goalId).count()) {
      throw new DomainError('CONFLICT', 'errors.alreadyJudged', { goalId });
    }
    const f: GoalFollowUp = { id: newId(), goalId, choice, createdAt: now };
    return appendImmutable('goalFollowUps', f, now);
  });
}

/** 判定の訂正（追記）。元の判定と段の状態は変えない */
export async function correctJudgment(
  judgmentId: ID,
  field: JudgmentCorrection['field'],
  newValue: number | string,
  reason: string,
  now: EpochMs,
): Promise<JudgmentCorrection> {
  const r = reason.trim();
  if (r.length < 1 || r.length > 200) throw new DomainError('VALIDATION', 'errors.required', { field: 'reason' });
  const numeric = field !== 'costNote';
  if (numeric ? typeof newValue !== 'number' || !Number.isFinite(newValue) : typeof newValue !== 'string' || !newValue.trim()) {
    throw new DomainError('VALIDATION', 'errors.required', { field });
  }
  return db.transaction('rw', [db.judgments, db.judgmentCorrections, db.ledger], async () => {
    if (!(await db.judgments.get(judgmentId))) throw new DomainError('NOT_FOUND', 'errors.notFound', { judgmentId });
    const c: JudgmentCorrection = {
      id: newId(),
      judgmentId,
      field,
      newValue: typeof newValue === 'string' ? newValue.trim() : newValue,
      reason: r,
      createdAt: now,
    };
    return appendImmutable('judgmentCorrections', c, now);
  });
}

/** 予想を足せるか（I5）。段が OPEN で、判定がなく、today <= deadline のときだけ */
export async function assertCanPredict(goalId: ID, today: LocalDate): Promise<Goal> {
  const g = await requireGoal(goalId);
  const judged = (await db.judgments.where('goalId').equals(goalId).count()) > 0;
  if (g.status !== 'OPEN' || judged || today > g.deadline) throw new DomainError('ORDER_VIOLATION', 'errors.orderViolation', { goalId });
  return g;
}

/** 予想を追記する（I5） */
export async function addPrediction(
  goalId: ID,
  kind: Prediction['kind'],
  value: OutcomePredictionValue | AffectPredictionValue,
  sessionId: ID | null,
  now: EpochMs,
): Promise<Prediction> {
  return db.transaction('rw', [db.goals, db.judgments, db.predictions, db.ledger], async () => {
    await assertCanPredict(goalId, logicalDate(now));
    const p: Prediction = { id: newId(), goalId, kind, value, predictedAt: now, sessionId };
    return appendImmutable('predictions', p, now);
  });
}

/** 感情予想の実際の値（一意） */
export async function recordAffectActual(
  predictionId: ID,
  input: { intensity: number; durationMin: number },
  now: EpochMs,
): Promise<AffectActual> {
  return db.transaction('rw', [db.affectActuals, db.ledger], async () => {
    if (await db.affectActuals.where('predictionId').equals(predictionId).count()) {
      throw new DomainError('CONFLICT', 'errors.alreadyJudged', { predictionId });
    }
    const a: AffectActual = { id: newId(), predictionId, ...input, at: now };
    return appendImmutable('affectActuals', a, now);
  });
}

/** §8.7.5 の結果のうち、まだない (goalId, rule) のフラグを作る（却下済みでも作り直さない） */
export async function syncStallFlags(_today: LocalDate, now: EpochMs): Promise<StallFlag[]> {
  return db.transaction(
    'rw',
    [db.goals, db.deadlineExtensions, db.judgments, db.goalFollowUps, db.stallFlags, db.settings],
    async () => {
      const settings = (await db.settings.get('singleton')) ?? defaultSettings(now);
      const hits = detectStalls(
        {
          goals: await db.goals.toArray(),
          extensions: await db.deadlineExtensions.toArray(),
          judgments: await db.judgments.toArray(),
          followUps: await db.goalFollowUps.toArray(),
        },
        settings,
        now,
      );
      const existing = new Set((await db.stallFlags.toArray()).map((f) => `${f.goalId}|${f.rule}`));
      const created: StallFlag[] = [];
      for (const h of hits) {
        if (existing.has(`${h.goalId}|${h.rule}`)) continue;
        const flag: StallFlag = { id: newId(), goalId: h.goalId, rule: h.rule, detectedAt: now, dismissedAt: null };
        await db.stallFlags.add(flag);
        created.push(flag);
      }
      return created;
    },
  );
}

/** dismissedAt を1回だけ入れる。既に入っていれば何もしない */
export async function dismissStallFlag(id: ID, now: EpochMs): Promise<void> {
  await db.transaction('rw', db.stallFlags, async () => {
    const f = await db.stallFlags.get(id);
    if (f && f.dismissedAt === null) await db.stallFlags.update(id, { dismissedAt: now });
  });
}

/** 段の非表示。最上位の段は非表示にできない（I19） */
export async function hideGoal(id: ID, now: EpochMs): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    const g = await requireGoal(id);
    if (g.parentId === null) throw new DomainError('CONFLICT', 'errors.hideRoot', { id });
    await db.goals.update(id, { hiddenAt: now });
  });
}

export async function unhideGoal(id: ID): Promise<void> {
  await db.goals.update(id, { hiddenAt: null });
}
