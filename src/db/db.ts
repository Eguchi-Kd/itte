// Dexie スキーマ（§7.3）。スキーマを変えるときは version(2) を足し、既存の version を書き換えない
import Dexie, { type Table } from 'dexie';
import type {
  AffectActual,
  AppOpen,
  BoardItem,
  Candidate,
  Commitment,
  Countermeasure,
  DailyCheck,
  DeadlineExtension,
  EscapeLog,
  EvaluationFunction,
  Experiment,
  Goal,
  GoalFollowUp,
  Habit,
  HabitLog,
  Joseki,
  Judgment,
  JudgmentCorrection,
  JudgmentRequest,
  LedgerEntry,
  LocalDate,
  Measurement,
  Metric,
  Move,
  MoveReview,
  Prediction,
  ReasonTag,
  Session,
  Settings,
  StallFlag,
  StuckLog,
  Task,
  TurnTrigger,
  WeeklyCheck,
  WeeklyReviewRun,
} from '../domain/types';
import { installImmutabilityHooks } from './hooks';

export const DB_NAME = 'itte';

export type ItteDB = Dexie & {
  settings: Table<Settings, 'singleton'>;
  appOpens: Table<AppOpen, LocalDate>;
  experiments: Table<Experiment, string>;
  weeklyReviewRuns: Table<WeeklyReviewRun, string>;
  habits: Table<Habit, string>;
  habitLogs: Table<HabitLog, string>;
  reasonTags: Table<ReasonTag, string>;
  weeklyChecks: Table<WeeklyCheck, string>;
  countermeasures: Table<Countermeasure, string>;
  tasks: Table<Task, string>;
  sessions: Table<Session, string>;
  stuckLogs: Table<StuckLog, string>;
  escapeLogs: Table<EscapeLog, string>;
  dailyChecks: Table<DailyCheck, LocalDate>;
  evaluationFunctions: Table<EvaluationFunction, string>;
  boardItems: Table<BoardItem, string>;
  turnTriggers: Table<TurnTrigger, string>;
  moves: Table<Move, string>;
  candidates: Table<Candidate, string>;
  moveReviews: Table<MoveReview, string>;
  joseki: Table<Joseki, string>;
  metrics: Table<Metric, string>;
  measurements: Table<Measurement, string>;
  goals: Table<Goal, string>;
  predictions: Table<Prediction, string>;
  affectActuals: Table<AffectActual, string>;
  commitments: Table<Commitment, string>;
  judgmentRequests: Table<JudgmentRequest, string>;
  judgments: Table<Judgment, string>;
  judgmentCorrections: Table<JudgmentCorrection, string>;
  deadlineExtensions: Table<DeadlineExtension, string>;
  stallFlags: Table<StallFlag, string>;
  goalFollowUps: Table<GoalFollowUp, string>;
  ledger: Table<LedgerEntry, number>;
};

export const SCHEMA_V1 = {
  settings: 'id',
  appOpens: 'date',
  experiments: 'id, startDate',
  weeklyReviewRuns: 'id, &weekStart',
  // 習慣
  habits: 'id, status, startedOn',
  habitLogs: 'id, habitId, date, &[habitId+date]',
  reasonTags: 'id, order',
  weeklyChecks: 'id, habitId, weekStart, &[habitId+weekStart]',
  countermeasures: 'id, habitId',
  // 着手
  tasks: 'id, plannedFor, createdAt',
  sessions: 'id, taskId, startedAt',
  stuckLogs: 'id, sessionId, taskId, at',
  escapeLogs: 'id, at, taskId, sessionId',
  dailyChecks: 'date',
  // 盤面
  evaluationFunctions: 'id, startDate, endDate',
  boardItems: 'id, type, status',
  turnTriggers: 'id, createdAt',
  moves: 'id, createdAt, triggerId',
  candidates: 'id, moveId, &[moveId+position]',
  moveReviews: 'id, &moveId, reviewedAt',
  joseki: 'id, order',
  // 段
  metrics: 'id',
  measurements: 'id, metricId, measuredAt, [metricId+measuredAt]',
  goals: 'id, parentId, recutOfId, metricId, deadline, status',
  predictions: 'id, goalId, kind, predictedAt',
  affectActuals: 'id, &predictionId',
  commitments: 'id, goalId, &[goalId+condition]',
  judgmentRequests: 'goalId',
  judgments: 'id, &goalId, judgedAt',
  judgmentCorrections: 'id, judgmentId',
  deadlineExtensions: 'id, goalId',
  stallFlags: 'id, goalId, &[goalId+rule]',
  goalFollowUps: 'id, &goalId',
  // 台帳
  ledger: '++seq, table, recordId',
} as const;

export const TABLE_NAMES = Object.keys(SCHEMA_V1) as (keyof typeof SCHEMA_V1)[];

export function createDb(name: string = DB_NAME): ItteDB {
  const d = new Dexie(name) as ItteDB;
  d.version(1).stores(SCHEMA_V1);
  installImmutabilityHooks(d);
  return d;
}

export const db = createDb();
