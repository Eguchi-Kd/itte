// 指標の計算（§9.3）。すべて純粋関数で、配列を受け取り DB に触らない
import { blindSpotStats } from '../board/moves';
import { addDays, dayStart, diffDays, inRange, logicalDate, weekStartOf } from '../dates';
import type {
  AppOpen,
  DailyCheck,
  DeadlineExtension,
  Enjoyed,
  EpochMs,
  EscapeLog,
  Goal,
  GoalFollowUp,
  Judgment,
  LocalDate,
  Measurement,
  Move,
  MoveReview,
  PriorState,
  Session,
  StuckLog,
  Task,
  WeeklyReviewRun,
} from '../types';

type PriorStateKey = PriorState | 'none';
type EnjoyedKey = Enjoyed | 'none';

export { affectErrors, calibrationError, medianDelayHours } from '../goals/calibration';

const MIN = 60_000;
const DAY = 86_400_000;
const TEN_MIN = 10 * MIN;

/** 割合。分母が0なら value は null */
export interface Ratio {
  value: number | null;
  /** 分子 */
  n: number;
  /** 分母 */
  d: number;
}

export function ratio(n: number, d: number): Ratio {
  return { value: d === 0 ? null : n / d, n, d };
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ===== 着手【着】 =====

/**
 * 「やること×予定日」の組を単位にする。各やることの予定日（planHistory と plannedFor）のうち期間内のものそれぞれについて、
 * その論理日にそのやることのセッションが1件以上あれば「着手」（D29）
 */
export function startRate(tasks: readonly Task[], sessions: readonly Session[], from: LocalDate, to: LocalDate): Ratio {
  const startedDays = new Set(sessions.map((s) => `${s.taskId}|${logicalDate(s.startedAt)}`));
  let n = 0;
  let d = 0;
  for (const t of tasks) {
    for (const date of new Set([...t.planHistory, t.plannedFor])) {
      if (!inRange(date, from, to)) continue;
      d += 1;
      if (startedDays.has(`${t.id}|${date}`)) n += 1;
    }
  }
  return ratio(n, d);
}

/**
 * 詰まった後に続けた割合。(a) fill／research5 で、そのセッションが abandoned でない。
 * (b) stop で、同じやることの新しいセッションが at から10分以内に始まった
 */
export function stuckContinueRate(stuckLogs: readonly StuckLog[], sessions: readonly Session[]): Ratio {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  let n = 0;
  for (const l of stuckLogs) {
    if (l.choice === 'stop') {
      if (sessions.some((s) => s.taskId === l.taskId && s.id !== l.sessionId && s.startedAt >= l.at && s.startedAt - l.at <= TEN_MIN)) n += 1;
    } else {
      const s = byId.get(l.sessionId);
      if (s && s.outcome !== 'abandoned') n += 1;
    }
  }
  return ratio(n, stuckLogs.length);
}

/**
 * 比較用。StuckLog がなく、stopped（10分未満で止めた）か abandoned で終わったセッションのうち、
 * 同じやることの新しいセッションが endedAt から10分以内に始まった割合
 */
export function noStuckContinueRate(stuckLogs: readonly StuckLog[], sessions: readonly Session[]): Ratio {
  const stuck = new Set(stuckLogs.map((l) => l.sessionId));
  const targets = sessions.filter(
    (s) =>
      !stuck.has(s.id) &&
      s.endedAt !== null &&
      (s.outcome === 'abandoned' || (s.outcome === 'stopped' && s.endedAt - s.startedAt < TEN_MIN)),
  );
  const n = targets.filter((s) =>
    sessions.some((x) => x.taskId === s.taskId && x.id !== s.id && x.startedAt >= (s.endedAt ?? 0) && x.startedAt - (s.endedAt ?? 0) <= TEN_MIN),
  ).length;
  return ratio(n, targets.length);
}

export interface EscapeBreakdown {
  total: number;
  priorState: Record<PriorStateKey, number>;
  enjoyed: Record<EnjoyedKey, number>;
}

/** priorState 別・enjoyed 別の件数。null は「未記入（none）」として別に数える */
export function escapeBreakdown(escapeLogs: readonly EscapeLog[]): EscapeBreakdown {
  const priorState: Record<PriorStateKey, number> = { anxiety: 0, fatigue: 0, ambiguity: 0, boredom: 0, none: 0 };
  const enjoyed: Record<EnjoyedKey, number> = { yes: 0, no: 0, partly: 0, none: 0 };
  for (const e of escapeLogs) {
    priorState[e.priorState ?? 'none'] += 1;
    enjoyed[e.enjoyed ?? 'none'] += 1;
  }
  return { total: escapeLogs.length, priorState, enjoyed };
}

/** abandoned のセッションのうち、sessionId が一致する EscapeLog があるものの割合 */
export function escapeRecordRate(sessions: readonly Session[], escapeLogs: readonly EscapeLog[]): Ratio {
  const recorded = new Set(escapeLogs.map((e) => e.sessionId).filter((x): x is string => x !== null));
  const abandoned = sessions.filter((s) => s.outcome === 'abandoned');
  return ratio(abandoned.filter((s) => recorded.has(s.id)).length, abandoned.length);
}

/** pendingWorry の true／false 別に、consumptionMin の中央値と件数 */
export function driftByWorry(dailyChecks: readonly DailyCheck[]): {
  worry: { median: number | null; n: number };
  noWorry: { median: number | null; n: number };
} {
  const w = dailyChecks.filter((c) => c.pendingWorry).map((c) => c.consumptionMin);
  const nw = dailyChecks.filter((c) => !c.pendingWorry).map((c) => c.consumptionMin);
  return { worry: { median: median(w), n: w.length }, noWorry: { median: median(nw), n: nw.length } };
}

// ===== 盤面【盤】 =====

export function badRate(moves: readonly Move[], reviews: readonly MoveReview[], from: LocalDate, to: LocalDate): Ratio {
  const s = blindSpotStats(moves, reviews, from, to);
  return ratio(s.bad, s.total);
}

/** retro=true の手の週ごとの件数（事後の気づき）。期間内の週をすべて並べる */
export function retroCountByWeek(moves: readonly Move[], from: LocalDate, to: LocalDate): { weekStart: LocalDate; count: number }[] {
  const out: { weekStart: LocalDate; count: number }[] = [];
  for (let ws = weekStartOf(from); ws <= to; ws = addDays(ws, 7)) {
    const end = addDays(ws, 6);
    out.push({
      weekStart: ws,
      count: moves.filter((m) => m.retro && inRange(logicalDate(m.createdAt), ws, end) && inRange(logicalDate(m.createdAt), from, to)).length,
    });
  }
  return out;
}

/** 期間内の週（月曜始まり）のうち、completedAt がある週の割合 */
export function weeklyReviewCompletionRate(runs: readonly WeeklyReviewRun[], from: LocalDate, to: LocalDate): Ratio {
  const done = new Set(runs.filter((r) => r.completedAt !== null).map((r) => r.weekStart));
  let n = 0;
  let d = 0;
  for (let ws = weekStartOf(from); ws <= to; ws = addDays(ws, 7)) {
    d += 1;
    if (done.has(ws)) n += 1;
  }
  return ratio(n, d);
}

// ===== 段【刻】 =====

/** 延長回数 ÷ 判定総数 */
export function extensionRate(extensions: readonly DeadlineExtension[], judgments: readonly Judgment[]): Ratio {
  return ratio(extensions.length, judgments.length);
}

/** 判定から30日以上たった UNMET の段のうち、30日以内に子の段が作られた割合 */
export function kizamiRate(goals: readonly Goal[], judgments: readonly Judgment[], _followUps: readonly GoalFollowUp[], now: EpochMs): Ratio {
  const judgedAt = new Map(judgments.map((j) => [j.goalId, j.judgedAt]));
  const targets = goals.filter((g) => g.status === 'UNMET' && judgedAt.has(g.id) && now - (judgedAt.get(g.id) ?? now) >= 30 * DAY);
  const n = targets.filter((g) => goals.some((c) => c.parentId === g.id && c.createdAt <= (judgedAt.get(g.id) ?? 0) + 30 * DAY)).length;
  return ratio(n, targets.length);
}

/** 判定済みの段のうち、作成から期限までにその指標の実測（source='manual'）が1件以上ある割合 */
export function measurementRate(goals: readonly Goal[], measurements: readonly Measurement[], judgments: readonly Judgment[]): Ratio {
  const judged = new Set(judgments.map((j) => j.goalId));
  const targets = goals.filter((g) => judged.has(g.id));
  const n = targets.filter((g) => {
    const end = dayStart(addDays(g.deadline, 1));
    return measurements.some((m) => m.metricId === g.metricId && m.source === 'manual' && m.measuredAt >= g.createdAt && m.measuredAt < end);
  }).length;
  return ratio(n, targets.length);
}

/** 期間の日数のうち、アプリを開いた論理日の割合 */
export function usageRate(appOpens: readonly AppOpen[], from: LocalDate, to: LocalDate): Ratio {
  const days = diffDays(to, from) + 1;
  const opened = new Set(appOpens.map((a) => a.date).filter((d) => inRange(d, from, to)));
  return ratio(opened.size, Math.max(0, days));
}
