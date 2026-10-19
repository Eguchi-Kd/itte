// 仮説と反証条件（§9.4）。各判定関数は { status, detail } を返す。detail は事実（数値）だけ
import { blindSpotStats, bottleneck } from '../board/moves';
import { inRange, logicalDate } from '../dates';
import { experimentWeek, experimentWeeks, phaseFor } from '../experiment';
import { calibrationError, calibrationSeries, medianDelayHours } from '../goals/calibration';
import type {
  AppOpen,
  DailyCheck,
  EscapeLog,
  Experiment,
  ExperimentPreset,
  Goal,
  GoalFollowUp,
  Judgment,
  JudgmentCorrection,
  LocalDate,
  Metric,
  Move,
  MoveReview,
  Prediction,
  Session,
  StuckLog,
  Task,
  WeeklyReviewRun,
} from '../types';
import {
  driftByWorry,
  escapeRecordRate,
  kizamiRate,
  noStuckContinueRate,
  retroCountByWeek,
  startRate,
  stuckContinueRate,
  usageRate,
  weeklyReviewCompletionRate,
} from './metrics';
import {
  B1_MIN_REVIEWS,
  B2_MIN_BAD,
  B4_MIN_RATE,
  H1_MIN_DIFF,
  H1_MIN_PAIRS,
  H2_MIN_FILLED,
  H2_MIN_RECORD_RATE,
  H3_MIN_DIFF,
  H3_MIN_N,
  K3_MIN_USAGE,
  K_MIN_JUDGMENTS,
  U1_MIN_DAYS,
  U1_MIN_DIFF_MIN,
} from './thresholds';

export type HypothesisStatus = 'running' | 'insufficient' | 'supported' | 'falsified' | 'undetermined';
export interface HypothesisResult {
  id: string;
  status: HypothesisStatus;
  detail: string;
}

export interface VerifyData {
  tasks: readonly Task[];
  sessions: readonly Session[];
  stuckLogs: readonly StuckLog[];
  escapeLogs: readonly EscapeLog[];
  dailyChecks: readonly DailyCheck[];
  moves: readonly Move[];
  moveReviews: readonly MoveReview[];
  runs: readonly WeeklyReviewRun[];
  goals: readonly Goal[];
  metrics: readonly Metric[];
  predictions: readonly Prediction[];
  judgments: readonly Judgment[];
  corrections: readonly JudgmentCorrection[];
  followUps: readonly GoalFollowUp[];
  appOpens: readonly AppOpen[];
}

const signed = (v: number) => `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}`;
const fmt = (v: number | null) => (v === null ? '-' : v.toFixed(2));
const r = (id: string, status: HypothesisStatus, detail: string): HypothesisResult => ({ id, status, detail });

type Period = { from: LocalDate; to: LocalDate };
const within = (ms: number, p: Period) => inRange(logicalDate(ms), p.from, p.to);

// ===== 着手プリセット =====

/** H1: 着手率の A→B の差が w1−w0 と w3−w2 のどちらも +0.20 以上 */
export function h1(d: VerifyData, startDate: LocalDate): HypothesisResult {
  const rates = [0, 1, 2, 3].map((k) => {
    const w = experimentWeek(startDate, k);
    return startRate(d.tasks, d.sessions, w.from, w.to);
  });
  if (rates.some((x) => x.d < H1_MIN_PAIRS || x.value === null)) return r('H1', 'insufficient', `n = ${rates.map((x) => x.d).join(', ')}`);
  const d1 = (rates[1].value ?? 0) - (rates[0].value ?? 0);
  const d2 = (rates[3].value ?? 0) - (rates[2].value ?? 0);
  const detail = `w1-w0 = ${signed(d1)}, w3-w2 = ${signed(d2)}`;
  return r('H1', d1 >= H1_MIN_DIFF - 1e-9 && d2 >= H1_MIN_DIFF - 1e-9 ? 'supported' : 'falsified', detail);
}

/** H2: 記入済みのうち「不安」が過半数、かつ「楽しくない」が過半数。記録率が50%未満なら判定不能 */
export function h2(d: VerifyData, period: Period): HypothesisResult {
  const logs = d.escapeLogs.filter((e) => within(e.at, period));
  const prior = logs.filter((e) => e.priorState !== null);
  const enjoyed = logs.filter((e) => e.enjoyed !== null);
  const rate = escapeRecordRate(d.sessions.filter((s) => within(s.startedAt, period)), d.escapeLogs);
  const detail = `n = ${prior.length}, record = ${fmt(rate.value)}`;
  if (prior.length < H2_MIN_FILLED) return r('H2', 'insufficient', detail);
  if (rate.value !== null && rate.value < H2_MIN_RECORD_RATE) return r('H2', 'undetermined', detail);
  const count = (k: string) => prior.filter((e) => e.priorState === k).length;
  const anxietyMajority = count('anxiety') > prior.length / 2;
  const notFunMajority = enjoyed.filter((e) => e.enjoyed === 'no').length > enjoyed.length / 2;
  const funMajority = enjoyed.filter((e) => e.enjoyed === 'yes').length > enjoyed.length / 2;
  const max = Math.max(...['anxiety', 'fatigue', 'ambiguity', 'boredom'].map(count));
  const topIsBoredOrTired = (count('boredom') === max || count('fatigue') === max) && count('anxiety') < max;
  if (anxietyMajority && notFunMajority) return r('H2', 'supported', detail);
  if (topIsBoredOrTired || funMajority) return r('H2', 'falsified', detail);
  return r('H2', 'undetermined', detail);
}

/** H3: B 週の詰まり後の継続率が、詰まりなしで止めた後の継続率より 0.10 以上高い */
export function h3(d: VerifyData, startDate: LocalDate): HypothesisResult {
  const bWeeks = [experimentWeek(startDate, 1), experimentWeek(startDate, 3)];
  const inB = (ms: number) => bWeeks.some((w) => within(ms, w));
  const sessions = d.sessions.filter((s) => inB(s.startedAt));
  const stuck = stuckContinueRate(d.stuckLogs.filter((l) => inB(l.at)), d.sessions);
  const noStuck = noStuckContinueRate(d.stuckLogs, sessions);
  const detail = `stuck = ${fmt(stuck.value)} (${stuck.d}), none = ${fmt(noStuck.value)} (${noStuck.d})`;
  if (stuck.d < H3_MIN_N || noStuck.d < H3_MIN_N || stuck.value === null || noStuck.value === null) return r('H3', 'insufficient', detail);
  // TODO(spec): 15-6 差 0.10 は暫定値
  return r('H3', stuck.value - noStuck.value >= H3_MIN_DIFF - 1e-9 ? 'supported' : 'falsified', detail);
}

/** U1（未解決の論点 15-5）: 気がかりのない日の消費時間の中央値が、ある日より15分以上少ない → 背景不安説（supported） */
export function u1(d: VerifyData, period: Period): HypothesisResult {
  const drift = driftByWorry(d.dailyChecks.filter((c) => inRange(c.date, period.from, period.to)));
  const detail = `worry = ${fmt(drift.worry.median)} (${drift.worry.n}), none = ${fmt(drift.noWorry.median)} (${drift.noWorry.n})`;
  if (drift.worry.n < U1_MIN_DAYS || drift.noWorry.n < U1_MIN_DAYS) return r('U1', 'insufficient', detail);
  // TODO(spec): 15-6 差15分は暫定値
  const diff = (drift.worry.median ?? 0) - (drift.noWorry.median ?? 0);
  return r('U1', diff >= U1_MIN_DIFF_MIN ? 'supported' : 'falsified', detail);
}

// ===== 盤面プリセット =====

export function b1(d: VerifyData, startDate: LocalDate): HypothesisResult {
  const a = experimentWeeks(startDate, 0, 1);
  const b = experimentWeeks(startDate, 6, 9);
  const sa = blindSpotStats(d.moves, d.moveReviews, a.from, a.to);
  const sb = blindSpotStats(d.moves, d.moveReviews, b.from, b.to);
  const detail = `A = ${fmt(sa.badRate)} (${sa.total}), B = ${fmt(sb.badRate)} (${sb.total})`;
  if (sa.total < B1_MIN_REVIEWS || sb.total < B1_MIN_REVIEWS) return r('B1', 'insufficient', detail);
  return r('B1', (sb.badRate ?? 0) < (sa.badRate ?? 0) ? 'supported' : 'falsified', detail);
}

export function b2(d: VerifyData, startDate: LocalDate): HypothesisResult {
  const b = experimentWeeks(startDate, 2, 9);
  const s = blindSpotStats(d.moves, d.moveReviews, b.from, b.to);
  const detail = `board ${s.byBlindSpot.board}, eval ${s.byBlindSpot.eval}, trigger ${s.byBlindSpot.trigger}, reading ${s.byBlindSpot.reading}`;
  if (s.bad < B2_MIN_BAD) return r('B2', 'insufficient', detail);
  const top = bottleneck(s.byBlindSpot);
  if (top === null) return r('B2', 'undetermined', detail);
  return r('B2', top === 'reading' ? 'falsified' : 'supported', detail);
}

export function b3(d: VerifyData, startDate: LocalDate): HypothesisResult {
  const first = experimentWeeks(startDate, 2, 5);
  const second = experimentWeeks(startDate, 6, 9);
  const sum = (p: Period) => retroCountByWeek(d.moves, p.from, p.to).reduce((s, w) => s + w.count, 0);
  const a = sum(first);
  const b = sum(second);
  const detail = `w2-5 = ${a}, w6-9 = ${b}`;
  if (a === 0) return r('B3', 'insufficient', detail);
  return r('B3', b < a ? 'supported' : 'falsified', detail);
}

export function b4(d: VerifyData, startDate: LocalDate): HypothesisResult {
  const all = experimentWeeks(startDate, 0, 9);
  const rate = weeklyReviewCompletionRate(d.runs, all.from, all.to);
  return r('B4', (rate.value ?? 0) >= B4_MIN_RATE ? 'supported' : 'falsified', `rate = ${fmt(rate.value)}`);
}

// ===== 段プリセット =====

function judgedIn(d: VerifyData, p: Period): Judgment[] {
  return d.judgments.filter((j) => within(j.judgedAt, p));
}

export function k1(d: VerifyData, startDate: LocalDate): HypothesisResult {
  const p1 = experimentWeeks(startDate, 2, 5);
  const p2 = experimentWeeks(startDate, 8, 11);
  const e = (p: Period) => calibrationError(calibrationSeries(judgedIn(d, p), d.goals, d.metrics, d.predictions, d.corrections));
  const j1 = judgedIn(d, p1).length;
  const j2 = judgedIn(d, p2).length;
  const e1 = e(p1);
  const e2 = e(p2);
  const detail = `|E1| = ${fmt(e1 === null ? null : Math.abs(e1))} (${j1}), |E2| = ${fmt(e2 === null ? null : Math.abs(e2))} (${j2})`;
  if (j1 < K_MIN_JUDGMENTS || j2 < K_MIN_JUDGMENTS || e1 === null || e2 === null) return r('K1', 'insufficient', detail);
  return r('K1', Math.abs(e2) < Math.abs(e1) ? 'supported' : 'falsified', detail);
}

export function k2(d: VerifyData, startDate: LocalDate): HypothesisResult {
  const j1 = judgedIn(d, experimentWeeks(startDate, 2, 5));
  const j2 = judgedIn(d, experimentWeeks(startDate, 8, 11));
  const m1 = medianDelayHours(j1);
  const m2 = medianDelayHours(j2);
  const detail = `B1 = ${fmt(m1)}h (${j1.length}), B2 = ${fmt(m2)}h (${j2.length})`;
  if (j1.length < K_MIN_JUDGMENTS || j2.length < K_MIN_JUDGMENTS || m1 === null || m2 === null) return r('K2', 'insufficient', detail);
  return r('K2', m2 > m1 ? 'falsified' : 'supported', detail);
}

export function k3(d: VerifyData, startDate: LocalDate): HypothesisResult {
  const p = experimentWeeks(startDate, 2, 5);
  const u = usageRate(d.appOpens, p.from, p.to);
  return r('K3', (u.value ?? 0) < K3_MIN_USAGE ? 'falsified' : 'supported', `usage = ${fmt(u.value)}`);
}

export function k4(d: VerifyData, startDate: LocalDate, now: number): HypothesisResult {
  const at = (p: Period) => {
    // 対象の段は期間内の判定で決まる（子の段を探すため、段はすべて渡す）
    const judgments = judgedIn(d, p);
    return { rate: kizamiRate(d.goals, judgments, d.followUps, now), n: judgments.length };
  };
  const a = at(experimentWeeks(startDate, 2, 5));
  const b = at(experimentWeeks(startDate, 8, 11));
  const detail = `B1 = ${fmt(a.rate.value)} (${a.n}), B2 = ${fmt(b.rate.value)} (${b.n})`;
  if (a.n < K_MIN_JUDGMENTS || b.n < K_MIN_JUDGMENTS || a.rate.value === null || b.rate.value === null) return r('K4', 'insufficient', detail);
  return r('K4', b.rate.value > a.rate.value ? 'supported' : 'falsified', detail);
}

export const HYPOTHESES: Record<ExperimentPreset, readonly string[]> = {
  start: ['H1', 'H2', 'H3', 'U1'],
  board: ['B1', 'B2', 'B3', 'B4'],
  kizami: ['K1', 'K2', 'K3', 'K4'],
};

/** 実験の仮説の判定。実験中（終了前）はすべて running */
export function evaluateExperiment(e: Experiment, d: VerifyData, today: LocalDate, now: number): HypothesisResult[] {
  const finished = e.stoppedAt !== null || phaseFor(e.preset, e.startDate, today) === 'done';
  if (!finished) return HYPOTHESES[e.preset].map((id) => r(id, 'running', ''));
  const s = e.startDate;
  switch (e.preset) {
    case 'start': {
      const all = experimentWeeks(s, 0, 3);
      return [h1(d, s), h2(d, all), h3(d, s), u1(d, all)];
    }
    case 'board':
      return [b1(d, s), b2(d, s), b3(d, s), b4(d, s)];
    case 'kizami':
      return [k1(d, s), k2(d, s), k3(d, s), k4(d, s, now)];
  }
}
