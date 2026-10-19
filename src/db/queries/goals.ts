import type {
  AffectActual,
  Commitment,
  DeadlineExtension,
  Goal,
  GoalFollowUp,
  Judgment,
  JudgmentCorrection,
  JudgmentRequest,
  Measurement,
  Metric,
  Prediction,
  StallFlag,
} from '../../domain/types';
import { db } from '../db';

export function queryMetrics(): Promise<Metric[]> {
  return db.metrics.toArray();
}

export function queryGoal(id: string): Promise<Goal | undefined> {
  return db.goals.get(id);
}

export interface MetricsData {
  metrics: Metric[];
  measurements: Measurement[];
}

export async function queryMetricsData(): Promise<MetricsData> {
  const [metrics, measurements] = await Promise.all([db.metrics.toArray(), db.measurements.toArray()]);
  return { metrics, measurements };
}

/** 段のモジュールの全データ（段の詳細・判定の履歴・較正で使う。個人1名分なので全件読む） */
export interface GoalsData {
  goals: Goal[];
  metrics: Metric[];
  measurements: Measurement[];
  commitments: Commitment[];
  predictions: Prediction[];
  affectActuals: AffectActual[];
  requests: JudgmentRequest[];
  judgments: Judgment[];
  corrections: JudgmentCorrection[];
  extensions: DeadlineExtension[];
  followUps: GoalFollowUp[];
  stallFlags: StallFlag[];
}

export async function queryGoalsData(): Promise<GoalsData> {
  const [goals, metrics, measurements, commitments, predictions, affectActuals, requests, judgments, corrections, extensions, followUps, stallFlags] =
    await Promise.all([
      db.goals.toArray(),
      db.metrics.toArray(),
      db.measurements.toArray(),
      db.commitments.toArray(),
      db.predictions.toArray(),
      db.affectActuals.toArray(),
      db.judgmentRequests.toArray(),
      db.judgments.toArray(),
      db.judgmentCorrections.toArray(),
      db.deadlineExtensions.toArray(),
      db.goalFollowUps.toArray(),
      db.stallFlags.toArray(),
    ]);
  return { goals, metrics, measurements, commitments, predictions, affectActuals, requests, judgments, corrections, extensions, followUps, stallFlags };
}
