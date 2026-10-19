// エクスポート形式（§8.12.4）。zod で検証し、不正なら読み込まない
import { z } from 'zod';

const id = z.string().min(1);
const ms = z.number().finite();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const str = z.string();
const nstr = z.string().nullable();
const persona = z.enum(['regret', 'optimist', 'meaning', 'selfblame', 'notfun']);

export const TABLE_SCHEMAS = {
  settings: z.object({
    id: z.literal('singleton'),
    onboarded: z.boolean(),
    persona: persona.nullable(),
    personaScores: z.record(persona, z.number()).nullable(),
    soundOn: z.boolean(),
    hapticsOn: z.boolean(),
    stallExtensionThreshold: z.number().int(),
    stallFollowUpDays: z.number().int(),
    stallRepeatedUnmet: z.number().int(),
    weeklyReviewIcs: z.object({ weekday: z.number().int(), time: str }),
    lastExportAt: ms.nullable(),
    introSeen: z.array(str),
    dismissed: z.record(str, str),
    installPromptShown: z.boolean(),
    createdAt: ms,
  }),
  appOpens: z.object({ date, firstAt: ms }),
  experiments: z.object({ id, preset: z.enum(['start', 'board', 'kizami']), startDate: date, stoppedAt: ms.nullable(), createdAt: ms }),
  weeklyReviewRuns: z.object({ id, weekStart: date, startedAt: ms, completedAt: ms.nullable(), cursor: z.number().int() }),
  habits: z.object({
    id,
    kind: z.enum(['build', 'replace']),
    name: str,
    replacesText: nstr,
    purpose: str,
    unit: str,
    amount: z.number(),
    minAmount: z.number(),
    amountChangedOn: date,
    schedule: z.object({ days: z.array(z.number().int()), time: nstr, cue: nstr }),
    place: str,
    how: str,
    commitmentNote: nstr,
    funNote: nstr,
    status: z.enum(['active', 'graduated', 'ended']),
    startedOn: date,
    endedOn: date.nullable(),
    endNote: nstr,
    createdAt: ms,
  }),
  habitLogs: z.object({ id, habitId: id, date, done: z.boolean(), amount: z.number(), reasonTagIds: z.array(str), memo: nstr, recordedAt: ms }),
  reasonTags: z.object({ id, label: str, builtIn: z.boolean(), archived: z.boolean(), order: z.number() }),
  weeklyChecks: z.object({
    id,
    habitId: id,
    weekStart: date,
    automaticity: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    habitReview: z
      .object({ stillUseful: z.number(), wouldChooseAgain: z.boolean(), decision: z.enum(['continue', 'reduce', 'end']) })
      .nullable(),
    answeredAt: ms,
  }),
  countermeasures: z.object({ id, habitId: id, conditionKey: str, conditionLabel: str, action: str, createdOn: date }),
  tasks: z.object({
    id,
    title: str,
    roughVersion: nstr,
    firstAction: nstr,
    nextStep: nstr,
    plannedFor: date,
    planHistory: z.array(date),
    boardItemId: nstr,
    goalId: nstr,
    createdAt: ms,
    archivedAt: ms.nullable(),
    closedReason: z.enum(['done', 'dropped']).nullable(),
  }),
  sessions: z.object({
    id,
    taskId: id,
    startedAt: ms,
    endedAt: ms.nullable(),
    plannedMin: z.literal(10),
    outcome: z.enum(['continued', 'stopped', 'abandoned']).nullable(),
    roughMode: z.boolean(),
    affectPredictionId: nstr,
  }),
  stuckLogs: z.object({ id, sessionId: id, taskId: id, at: ms, blocker: str, choice: z.enum(['fill', 'research5', 'stop']) }),
  escapeLogs: z.object({
    id,
    at: ms,
    taskId: nstr,
    sessionId: nstr,
    priorState: z.enum(['anxiety', 'fatigue', 'ambiguity', 'boredom']).nullable(),
    target: z.enum(['video', 'game', 'sleep', 'other']).nullable(),
    enjoyed: z.enum(['yes', 'no', 'partly']).nullable(),
  }),
  dailyChecks: z.object({ date, pendingWorry: z.boolean(), consumptionMin: z.number().int().min(0).max(1440), plannedTaskExists: z.boolean(), answeredAt: ms }),
  evaluationFunctions: z.object({ id, metric: str, avoid: z.array(str).max(3), startDate: date, endDate: date, createdAt: ms }),
  boardItems: z.object({
    id,
    type: z.enum(['deadline', 'event', 'project', 'resource']),
    title: str,
    dueDate: date.nullable(),
    status: z.enum(['open', 'done']),
    source: z.enum(['manual', 'ics']),
    externalUid: nstr,
    createdAt: ms,
  }),
  turnTriggers: z.object({ id, conditionText: str, active: z.boolean(), createdAt: ms }),
  moves: z.object({
    id,
    triggerId: nstr,
    situation: str,
    mode: z.enum(['full', 'quick']),
    retro: z.boolean(),
    irreversible: z.boolean(),
    unreadable: z.boolean(),
    chosenCandidateId: nstr,
    chosenText: nstr,
    decidedAt: ms.nullable(),
    phase: z.enum(['A', 'B']).nullable(),
    createdAt: ms,
  }),
  candidates: z.object({
    id,
    moveId: id,
    position: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    description: str,
    plus1: nstr,
    plus2: nstr,
    score: z.union([z.literal(-2), z.literal(-1), z.literal(0), z.literal(1), z.literal(2)]).nullable(),
  }),
  moveReviews: z.object({
    id,
    moveId: id,
    outcome: nstr,
    judgmentOk: z.boolean(),
    rating: z.enum(['good', 'neutral', 'bad']),
    blindSpot: z.enum(['board', 'eval', 'trigger', 'reading']).nullable(),
    note: nstr,
    reviewedAt: ms,
  }),
  joseki: z.object({ id, principle: str, origin: z.enum(['initial', 'review']), moveReviewId: nstr, archived: z.boolean(), order: z.number(), createdAt: ms }),
  metrics: z.object({
    id,
    name: str,
    unit: str,
    direction: z.enum(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER']),
    collectionMethod: str.min(1),
    verifiable: z.boolean(),
    createdAt: ms,
  }),
  measurements: z.object({ id, metricId: id, value: z.number(), measuredAt: ms, source: z.enum(['manual', 'judgment']), note: nstr, createdAt: ms }),
  goals: z.object({
    id,
    parentId: nstr,
    recutOfId: nstr,
    metricId: id,
    title: str,
    targetValue: z.number(),
    comparator: z.enum(['GTE', 'LTE']),
    // 期限のない段は読み込めない（§2.3-6）
    deadline: date,
    status: z.enum(['OPEN', 'MET', 'UNMET']),
    createdAt: ms,
    hiddenAt: ms.nullable(),
  }),
  predictions: z.object({
    id,
    goalId: id,
    kind: z.enum(['OUTCOME', 'AFFECT']),
    value: z.union([
      z.object({ probability: z.number(), value: z.number() }),
      z.object({ intensity: z.number(), durationMin: z.number() }),
    ]),
    predictedAt: ms,
    sessionId: nstr,
  }),
  affectActuals: z.object({ id, predictionId: id, intensity: z.number(), durationMin: z.number(), at: ms }),
  commitments: z.object({ id, goalId: id, condition: z.enum(['ON_MET', 'ON_UNMET']), nextAction: str, createdAt: ms }),
  judgmentRequests: z.object({ goalId: id, requestedAt: ms, detectedAt: ms }),
  judgments: z.object({
    id,
    goalId: id,
    outcome: z.enum(['MET', 'UNMET']),
    actualValue: z.number(),
    investedHours: z.number().nullable(),
    costNote: nstr,
    requestedAt: ms,
    detectedAt: ms,
    judgedAt: ms,
    enforced: z.boolean(),
  }),
  judgmentCorrections: z.object({
    id,
    judgmentId: id,
    field: z.enum(['actualValue', 'investedHours', 'costNote']),
    newValue: z.union([z.number(), z.string()]),
    reason: str,
    createdAt: ms,
  }),
  deadlineExtensions: z.object({ id, goalId: id, previousDeadline: date, newDeadline: date, reason: str, createdAt: ms }),
  stallFlags: z.object({
    id,
    goalId: id,
    rule: z.enum(['EXTENSION_3X', 'NO_FOLLOW_UP_30D', 'REPEATED_UNMET_3X']),
    detectedAt: ms,
    dismissedAt: ms.nullable(),
  }),
  goalFollowUps: z.object({ id, goalId: id, choice: z.enum(['KIZAMI', 'RECUT', 'WITHDRAW']), createdAt: ms }),
} as const;

export type DataTableName = keyof typeof TABLE_SCHEMAS;
export const DATA_TABLES = Object.keys(TABLE_SCHEMAS) as DataTableName[];

export const ledgerEntrySchema = z.object({
  seq: z.number().int().positive(),
  table: z.enum([
    'measurements',
    'predictions',
    'affectActuals',
    'commitments',
    'judgmentRequests',
    'judgments',
    'judgmentCorrections',
    'deadlineExtensions',
    'goalFollowUps',
  ]),
  recordId: str,
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  prevHash: z.string().regex(/^[0-9a-f]{64}$/),
  at: ms,
});

export const exportSchema = z.object({
  app: z.literal('itte'),
  version: z.literal(1),
  exportedAt: str,
  tables: z.object(
    Object.fromEntries(DATA_TABLES.map((t) => [t, z.array(TABLE_SCHEMAS[t])])) as {
      [K in DataTableName]: z.ZodArray<(typeof TABLE_SCHEMAS)[K]>;
    },
  ),
  ledger: z.array(ledgerEntrySchema),
});

export type ExportData = z.infer<typeof exportSchema>;

/** 'itte-backup-YYYYMMDD.json' などの日付部分 */
export function fileDate(today: string): string {
  return today.replace(/-/g, '');
}
