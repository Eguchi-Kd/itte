import { describe, expect, it } from 'vitest';
import { addDays, dayStart } from '../dates';
import { ALL_B, computeFlags, nextMonday, phaseFor, PRESET_SCHEDULE } from '../experiment';
import { b1, b2, b3, b4, evaluateExperiment, h1, h2, h3, k1, k2, k3, k4, u1, type VerifyData } from '../verify/hypotheses';
import type { Experiment, ExperimentPreset, Goal, Judgment, Move, MoveReview, Prediction, Session } from '../types';

const START = '2026-09-07'; // 月曜
const exp = (preset: ExperimentPreset, p: Partial<Experiment> = {}): Experiment => ({
  id: 'x',
  preset,
  startDate: START,
  stoppedAt: null,
  createdAt: 0,
  ...p,
});
/** 実験の週 k の d 日目（0〜6）の正午 */
const t = (k: number, d = 0, h = 12) => dayStart(addDays(START, 7 * k + d)) + (h - 4) * 3600_000;
const date = (k: number, d = 0) => addDays(START, 7 * k + d);

function empty(): VerifyData {
  return {
    tasks: [],
    sessions: [],
    stuckLogs: [],
    escapeLogs: [],
    dailyChecks: [],
    moves: [],
    moveReviews: [],
    runs: [],
    goals: [],
    metrics: [{ id: 'm', name: '章', unit: '章', direction: 'HIGHER_IS_BETTER', collectionMethod: 'x', verifiable: true, createdAt: 0 }],
    predictions: [],
    judgments: [],
    corrections: [],
    followUps: [],
    appOpens: [],
  };
}

describe('実験の条件', () => {
  it('AC-EXP-01: start プリセットで経過週0〜4が A, B, A, B, done（done のフラグはすべて true）', () => {
    const e = exp('start');
    expect([0, 1, 2, 3, 4].map((k) => phaseFor('start', START, date(k, 3)))).toEqual(['A', 'B', 'A', 'B', 'done']);
    expect(computeFlags([e], date(0))).toMatchObject({ phase: 'A', week: 0, roughStart: false, readingSheet: true, judgmentEnforced: true });
    expect(computeFlags([e], date(1, 6))).toMatchObject({ phase: 'B', week: 1, roughStart: true });
    expect(computeFlags([e], date(2))).toMatchObject({ phase: 'A', roughStart: false });
    expect(computeFlags([e], date(4))).toEqual(ALL_B);
    expect(phaseFor('start', START, addDays(START, -1))).toBe('notStarted');
    expect(computeFlags([e], addDays(START, -1))).toEqual(ALL_B);
  });

  it('AC-EXP-01: 実験がなければ、または中止すればフラグはすべて true', () => {
    expect(computeFlags([], '2026-10-18')).toEqual(ALL_B);
    expect(computeFlags([exp('start', { stoppedAt: 1 })], date(0))).toEqual(ALL_B);
  });

  it('AC-EXP-02: board と kizami の週ごとの条件が §9.2 の表と一致する', () => {
    expect(PRESET_SCHEDULE.board.join('')).toBe('AABBBBBBBB');
    expect(PRESET_SCHEDULE.kizami.join('')).toBe('AABBBBAABBBB');
    const board = Array.from({ length: 11 }, (_, k) => phaseFor('board', START, date(k)));
    expect(board).toEqual(['A', 'A', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'done']);
    const kizami = Array.from({ length: 13 }, (_, k) => phaseFor('kizami', START, date(k)));
    expect(kizami).toEqual(['A', 'A', 'B', 'B', 'B', 'B', 'A', 'A', 'B', 'B', 'B', 'B', 'done']);
    expect(computeFlags([exp('board')], date(1))).toMatchObject({ readingSheet: false, roughStart: true, judgmentEnforced: true });
    expect(computeFlags([exp('board')], date(2))).toMatchObject({ readingSheet: true, phase: 'B' });
    expect(computeFlags([exp('kizami')], date(6))).toMatchObject({ judgmentEnforced: false, readingSheet: true, roughStart: true });
    expect(computeFlags([exp('kizami')], date(8))).toMatchObject({ judgmentEnforced: true, phase: 'B' });
  });

  it('次の月曜', () => {
    expect(nextMonday('2026-10-18')).toBe('2026-10-19');
    expect(nextMonday('2026-10-19')).toBe('2026-10-26');
    expect(nextMonday('2026-10-17')).toBe('2026-10-19');
  });
});

// ===== 仮説 =====

function startData(started: [number, number, number, number], pairs = [3, 3, 3, 3]): VerifyData {
  const d = empty();
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < pairs[k]; i++) {
      const id = `t${k}${i}`;
      (d.tasks as unknown[]).push({ id, title: id, roughVersion: 'r', firstAction: 'f', nextStep: null, plannedFor: date(k, i), planHistory: [], boardItemId: null, goalId: null, createdAt: 0, archivedAt: null, closedReason: null });
      if (i < started[k]) (d.sessions as unknown[]).push(session(`s${k}${i}`, id, t(k, i)));
    }
  }
  return d;
}
function session(id: string, taskId: string, startedAt: number, p: Partial<Session> = {}): Session {
  return { id, taskId, startedAt, endedAt: null, plannedMin: 10, outcome: null, roughMode: true, affectPredictionId: null, ...p };
}

describe('AC-EXP-07: 着手プリセットの仮説', () => {
  it('H1: 支持・反証・データ不足', () => {
    expect(h1(startData([1, 3, 1, 3]), START)).toMatchObject({ status: 'supported', detail: 'w1-w0 = +0.67, w3-w2 = +0.67' });
    expect(h1(startData([1, 3, 1, 1]), START)).toMatchObject({ status: 'falsified', detail: 'w1-w0 = +0.67, w3-w2 = +0.00' });
    expect(h1(startData([1, 3, 1, 3], [2, 3, 3, 3]), START).status).toBe('insufficient');
  });

  const esc = (prior: string | null, enjoyed: string | null, i: number, sessionId: string | null = null) => ({
    id: `e${i}`,
    at: t(1, i % 7),
    taskId: null,
    sessionId,
    priorState: prior as never,
    target: null,
    enjoyed: enjoyed as never,
  });
  const period = { from: START, to: date(3, 6) };

  it('H2: 支持・反証・データ不足・判定不能', () => {
    const supported = { ...empty(), escapeLogs: [esc('anxiety', 'no', 0), esc('anxiety', 'no', 1), esc('anxiety', 'no', 2), esc('boredom', 'yes', 3), esc('boredom', 'yes', 4)] };
    expect(h2(supported, period).status).toBe('supported');
    const falsified = { ...empty(), escapeLogs: [esc('boredom', 'no', 0), esc('boredom', 'no', 1), esc('boredom', 'no', 2), esc('anxiety', 'yes', 3), esc('anxiety', 'yes', 4)] };
    expect(h2(falsified, period).status).toBe('falsified');
    expect(h2({ ...empty(), escapeLogs: supported.escapeLogs.slice(0, 4) }, period).status).toBe('insufficient');
    // 放置セッション2件のうち逃避ログがあるのは0件 → 記録率 0% → 判定不能
    const abandoned = [session('a1', 't', t(1, 1), { outcome: 'abandoned', endedAt: t(1, 1) + 600_000 }), session('a2', 't', t(1, 2), { outcome: 'abandoned', endedAt: t(1, 2) + 600_000 })];
    expect(h2({ ...supported, sessions: abandoned }, period)).toMatchObject({ status: 'undetermined', detail: 'n = 5, record = 0.00' });
  });

  it('H3: 支持・反証・データ不足', () => {
    const build = (resumeNoStuck: boolean, stuckCount = 5) => {
      const d = empty();
      for (let i = 0; i < stuckCount; i++) {
        (d.sessions as Session[]).push(session(`st${i}`, `t${i}`, t(1, i % 7, 10), { endedAt: t(1, i % 7, 10) + 600_000, outcome: 'continued' }));
        (d.stuckLogs as unknown[]).push({ id: `k${i}`, sessionId: `st${i}`, taskId: `t${i}`, at: t(1, i % 7, 10) + 60_000, blocker: 'x', choice: 'fill' });
      }
      for (let i = 0; i < 5; i++) {
        const start = t(3, i, 15);
        (d.sessions as Session[]).push(session(`ns${i}`, `u${i}`, start, { endedAt: start + 180_000, outcome: 'stopped' }));
        if (resumeNoStuck) (d.sessions as Session[]).push(session(`nr${i}`, `u${i}`, start + 300_000));
      }
      return d;
    };
    expect(h3(build(false), START)).toMatchObject({ status: 'supported', detail: 'stuck = 1.00 (5), none = 0.00 (5)' });
    expect(h3(build(true), START).status).toBe('falsified');
    expect(h3(build(false, 4), START).status).toBe('insufficient');
  });

  it('U1: 支持（背景不安説）・反証（既定値説）・データ不足', () => {
    const checks = (noWorryMin: number, n = 5) => [
      ...Array.from({ length: 5 }, (_, i) => ({ date: date(0, i), pendingWorry: true, consumptionMin: 120, plannedTaskExists: true, answeredAt: 0 })),
      ...Array.from({ length: n }, (_, i) => ({ date: date(1, i), pendingWorry: false, consumptionMin: noWorryMin, plannedTaskExists: true, answeredAt: 0 })),
    ];
    expect(u1({ ...empty(), dailyChecks: checks(30) }, period).status).toBe('supported');
    expect(u1({ ...empty(), dailyChecks: checks(105) }, period).status).toBe('supported'); // 差15分ちょうど
    expect(u1({ ...empty(), dailyChecks: checks(110) }, period).status).toBe('falsified');
    expect(u1({ ...empty(), dailyChecks: checks(30, 4) }, period).status).toBe('insufficient');
  });
});

function move(id: string, createdAt: number, retro = false): Move {
  return { id, triggerId: null, situation: id, mode: 'quick', retro, irreversible: false, unreadable: false, chosenCandidateId: null, chosenText: 'x', decidedAt: createdAt, phase: null, createdAt };
}
function rev(moveId: string, rating: MoveReview['rating'], blindSpot: MoveReview['blindSpot'] = null): MoveReview {
  return { id: `r${moveId}`, moveId, outcome: null, judgmentOk: true, rating, blindSpot, note: null, reviewedAt: 0 };
}

describe('AC-EXP-07: 盤面プリセットの仮説', () => {
  const reviewed = (week: number, ratings: MoveReview['rating'][]) => {
    const moves = ratings.map((_, i) => move(`w${week}m${i}`, t(week, i)));
    return { moves, reviews: ratings.map((r, i) => rev(moves[i].id, r, r === 'bad' ? 'board' : null)) };
  };
  const b1Data = (aBad: number, bBad: number, aTotal = 5) => {
    const a = reviewed(0, Array.from({ length: aTotal }, (_, i) => (i < aBad ? 'bad' : 'good')));
    const b = reviewed(7, Array.from({ length: 5 }, (_, i) => (i < bBad ? 'bad' : 'good')));
    return { ...empty(), moves: [...a.moves, ...b.moves], moveReviews: [...a.reviews, ...b.reviews] };
  };

  it('B1: 支持・反証・データ不足', () => {
    expect(b1(b1Data(3, 1), START)).toMatchObject({ status: 'supported', detail: 'A = 0.60 (5), B = 0.20 (5)' });
    expect(b1(b1Data(3, 3), START).status).toBe('falsified');
    expect(b1(b1Data(3, 1, 4), START).status).toBe('insufficient');
  });

  it('B2: 支持・反証・データ不足・判定不能', () => {
    const data = (spots: MoveReview['blindSpot'][]) => {
      const moves = spots.map((_, i) => move(`m${i}`, t(3, i)));
      return { ...empty(), moves, moveReviews: spots.map((s, i) => rev(moves[i].id, 'bad', s)) };
    };
    expect(b2(data(['board', 'board', 'reading']), START).status).toBe('supported');
    expect(b2(data(['reading', 'reading', 'board']), START).status).toBe('falsified');
    expect(b2(data(['reading', 'board']), START).status).toBe('insufficient');
    expect(b2(data(['reading', 'reading', 'board', 'board']), START).status).toBe('undetermined');
  });

  it('B3: 支持・反証・データ不足', () => {
    const data = (first: number, second: number) => ({
      ...empty(),
      moves: [...Array.from({ length: first }, (_, i) => move(`f${i}`, t(3, i), true)), ...Array.from({ length: second }, (_, i) => move(`s${i}`, t(7, i), true))],
    });
    expect(b3(data(3, 1), START)).toMatchObject({ status: 'supported', detail: 'w2-5 = 3, w6-9 = 1' });
    expect(b3(data(3, 3), START).status).toBe('falsified');
    expect(b3(data(0, 2), START).status).toBe('insufficient');
  });

  it('B4: 支持（50%以上）・反証', () => {
    const runs = (n: number) => Array.from({ length: n }, (_, k) => ({ id: `w${k}`, weekStart: addDays('2026-09-07', 7 * k), startedAt: 0, completedAt: 1, cursor: 0 }));
    expect(b4({ ...empty(), runs: runs(5) }, START).status).toBe('supported');
    expect(b4({ ...empty(), runs: runs(4) }, START).status).toBe('falsified');
  });
});

describe('AC-EXP-07: 段プリセットの仮説', () => {
  const NOW = dayStart('2027-01-31');
  /** 期間（週 a）に判定を n 件。予想と実測の差 err、遅延 hours */
  function judged(prefix: string, week: number, n: number, err: number, hours: number, status: Goal['status'] = 'UNMET') {
    const goals: Goal[] = [];
    const judgments: Judgment[] = [];
    const predictions: Prediction[] = [];
    for (let i = 0; i < n; i++) {
      const id = `${prefix}${i}`;
      const judgedAt = t(week, i);
      goals.push({ id, parentId: null, recutOfId: null, metricId: 'm', title: id, targetValue: 10, comparator: 'GTE', deadline: date(week - 1, i), status, createdAt: t(week - 2, i), hiddenAt: null });
      predictions.push({ id: `p${id}`, goalId: id, kind: 'OUTCOME', value: { probability: 50, value: 10 }, predictedAt: t(week - 2, i), sessionId: null });
      judgments.push({ id: `j${id}`, goalId: id, outcome: status === 'MET' ? 'MET' : 'UNMET', actualValue: 10 - err, investedHours: 1, costNote: 'x', requestedAt: judgedAt - hours * 3600_000, detectedAt: 0, judgedAt, enforced: true });
    }
    return { goals, judgments, predictions };
  }
  function data(p1: ReturnType<typeof judged>, p2: ReturnType<typeof judged>): VerifyData {
    return { ...empty(), goals: [...p1.goals, ...p2.goals], judgments: [...p1.judgments, ...p2.judgments], predictions: [...p1.predictions, ...p2.predictions] };
  }

  it('K1: 支持（|E_cal| が減る）・反証・データ不足', () => {
    expect(k1(data(judged('a', 3, 3, 5, 10), judged('b', 9, 3, 1, 10)), START)).toMatchObject({ status: 'supported', detail: '|E1| = 0.50 (3), |E2| = 0.10 (3)' });
    expect(k1(data(judged('a', 3, 3, 1, 10), judged('b', 9, 3, 5, 10)), START).status).toBe('falsified');
    expect(k1(data(judged('a', 3, 2, 5, 10), judged('b', 9, 3, 1, 10)), START).status).toBe('insufficient');
  });

  it('K2: 支持・反証（判定遅延が増える）・データ不足', () => {
    expect(k2(data(judged('a', 3, 3, 1, 20), judged('b', 9, 3, 1, 5)), START).status).toBe('supported');
    expect(k2(data(judged('a', 3, 3, 1, 5), judged('b', 9, 3, 1, 20)), START)).toMatchObject({ status: 'falsified', detail: 'B1 = 5.00h (3), B2 = 20.00h (3)' });
    expect(k2(data(judged('a', 3, 3, 1, 5), judged('b', 9, 1, 1, 20)), START).status).toBe('insufficient');
  });

  it('K3: 支持・反証（使用率が50%を下回る）', () => {
    const opens = (n: number) => Array.from({ length: n }, (_, i) => ({ date: addDays(date(2), i * 2), firstAt: 0 }));
    expect(k3({ ...empty(), appOpens: opens(14) }, START).status).toBe('supported');
    expect(k3({ ...empty(), appOpens: opens(13) }, START).status).toBe('falsified');
  });

  it('K4: 支持（刻みが増える）・反証（変化しない）・データ不足', () => {
    const p1 = judged('a', 3, 3, 1, 1);
    const p2 = judged('b', 9, 3, 1, 1);
    const child = (parent: string, at: number): Goal => ({ id: `c${parent}`, parentId: parent, recutOfId: null, metricId: 'm', title: 'c', targetValue: 1, comparator: 'GTE', deadline: '2027-03-01', status: 'OPEN', createdAt: at, hiddenAt: null });
    const withKids = { ...data(p1, p2), goals: [...p1.goals, ...p2.goals, child('b0', t(10)), child('b1', t(10))] };
    expect(k4(withKids, START, NOW)).toMatchObject({ status: 'supported', detail: 'B1 = 0.00 (3), B2 = 0.67 (3)' });
    expect(k4(data(p1, p2), START, NOW).status).toBe('falsified');
    expect(k4(data(judged('a', 3, 2, 1, 1), p2), START, NOW).status).toBe('insufficient');
  });
});

describe('evaluateExperiment', () => {
  it('実験中はすべて running、終わると各仮説を判定する', () => {
    expect(evaluateExperiment(exp('board'), empty(), date(3), 0).map((r) => r.status)).toEqual(['running', 'running', 'running', 'running']);
    const done = evaluateExperiment(exp('board'), empty(), date(10), 0);
    expect(done.map((r) => r.id)).toEqual(['B1', 'B2', 'B3', 'B4']);
    expect(done.map((r) => r.status)).toEqual(['insufficient', 'insufficient', 'insufficient', 'falsified']);
    expect(evaluateExperiment(exp('start', { stoppedAt: 1 }), empty(), date(1), 0).map((r) => r.id)).toEqual(['H1', 'H2', 'H3', 'U1']);
  });
});
