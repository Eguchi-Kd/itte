// 較正（§8.8、D37）【刻】。符号を残すのが要点（正＝予想が実測より良い側＝自己評価が高め）
import { addDays, dayStart } from '../dates';
import type {
  AffectActual,
  AffectPredictionValue,
  EpochMs,
  Goal,
  ID,
  Judgment,
  JudgmentCorrection,
  Metric,
  OutcomePredictionValue,
  Prediction,
} from '../types';
import { effectiveValue, judgmentDelayMs } from './judgment';

export interface CalibrationPoint {
  goalId: ID;
  judgedAt: EpochMs;
  /** 予想した値 p */
  predicted: number;
  /** 実測 a（訂正後） */
  actual: number;
  target: number;
  /** s × (p − a)（指標の単位のまま） */
  raw: number;
  /** raw / max(|targetValue|, 1) */
  norm: number;
  unit: string;
  metricId: ID;
}

/** その段の OUTCOME 予想のうち、期限前（期限日の翌日4:00より前）で最も新しいもの */
export function outcomePredictionFor(goal: Goal, predictions: readonly Prediction[]): Prediction | null {
  const end = dayStart(addDays(goal.deadline, 1));
  return (
    predictions
      .filter((p) => p.goalId === goal.id && p.kind === 'OUTCOME' && p.predictedAt < end)
      .sort((a, b) => b.predictedAt - a.predictedAt)[0] ?? null
  );
}

/** 判定日時の順の符号付き誤差。予想のない判定は除外する */
export function calibrationSeries(
  judgments: readonly Judgment[],
  goals: readonly Goal[],
  metrics: readonly Metric[],
  predictions: readonly Prediction[],
  corrections: readonly JudgmentCorrection[],
): CalibrationPoint[] {
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const metricById = new Map(metrics.map((m) => [m.id, m]));
  const out: CalibrationPoint[] = [];
  for (const j of [...judgments].sort((a, b) => a.judgedAt - b.judgedAt)) {
    const goal = goalById.get(j.goalId);
    const metric = goal ? metricById.get(goal.metricId) : undefined;
    if (!goal || !metric) continue;
    const pred = outcomePredictionFor(goal, predictions);
    if (!pred) continue;
    const p = (pred.value as OutcomePredictionValue).value;
    const a = effectiveValue(j, corrections, 'actualValue') ?? j.actualValue;
    const s = metric.direction === 'HIGHER_IS_BETTER' ? 1 : -1;
    const raw = s * (p - a);
    out.push({
      goalId: goal.id,
      judgedAt: j.judgedAt,
      predicted: p,
      actual: a,
      target: goal.targetValue,
      raw,
      norm: raw / Math.max(Math.abs(goal.targetValue), 1),
      unit: metric.unit,
      metricId: metric.id,
    });
  }
  return out;
}

/** 正規化した符号付き誤差の平均（E_cal）。件数0なら null */
export function calibrationError(series: readonly CalibrationPoint[]): number | null {
  if (series.length === 0) return null;
  return series.reduce((s, p) => s + p.norm, 0) / series.length;
}

/** 予想した確率の平均と、実際に届いた割合（予想のある判定だけ） */
export function probabilityCalibration(
  judgments: readonly Judgment[],
  goals: readonly Goal[],
  predictions: readonly Prediction[],
): { meanProbability: number | null; metRate: number | null; n: number } {
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const pairs: { p: number; met: boolean }[] = [];
  for (const j of judgments) {
    const g = goalById.get(j.goalId);
    const pred = g ? outcomePredictionFor(g, predictions) : null;
    if (pred) pairs.push({ p: (pred.value as OutcomePredictionValue).probability, met: j.outcome === 'MET' });
  }
  if (pairs.length === 0) return { meanProbability: null, metRate: null, n: 0 };
  return {
    meanProbability: pairs.reduce((s, x) => s + x.p, 0) / pairs.length,
    metRate: pairs.filter((x) => x.met).length / pairs.length,
    n: pairs.length,
  };
}

/** 実際の値がある AFFECT 予想について、強さと持続の「予想 − 実際」の平均と件数 */
export function affectErrors(
  predictions: readonly Prediction[],
  actuals: readonly AffectActual[],
): { intensity: number | null; duration: number | null; n: number } {
  const byPred = new Map(actuals.map((a) => [a.predictionId, a]));
  const pairs = predictions
    .filter((p) => p.kind === 'AFFECT' && byPred.has(p.id))
    .map((p) => ({ p: p.value as AffectPredictionValue, a: byPred.get(p.id) as AffectActual }));
  if (pairs.length === 0) return { intensity: null, duration: null, n: 0 };
  return {
    intensity: pairs.reduce((s, x) => s + (x.p.intensity - x.a.intensity), 0) / pairs.length,
    duration: pairs.reduce((s, x) => s + (x.p.durationMin - x.a.durationMin), 0) / pairs.length,
    n: pairs.length,
  };
}

/** 判定遅延の中央値（時間）。件数0なら null */
export function medianDelayHours(judgments: readonly Judgment[]): number | null {
  if (judgments.length === 0) return null;
  const hours = judgments.map((j) => judgmentDelayMs(j) / 3_600_000).sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2);
  return hours.length % 2 === 1 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
}
