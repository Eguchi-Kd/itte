import { describe, expect, it } from 'vitest';
import {
  affectErrors,
  calibrationError,
  calibrationSeries,
  medianDelayHours,
  probabilityCalibration,
} from '../goals/calibration';
import { dueGoals, pendingJudgments } from '../goals/deadlines';
import { defaultComparator, goalInputErrors } from '../goals/goal';
import { computeOutcome, effectiveValue, judgmentDelayMs, unmetDetailValid } from '../goals/judgment';
import { detectStalls } from '../goals/stall';
import { buildTree, depth, flattenTree, rootOf } from '../goals/tree';
import { dayStart } from '../dates';
import { correction, DAY, goal, judgment, metric, NOW, outcomePrediction } from './goalFixtures';

const SETTINGS = { stallExtensionThreshold: 3, stallFollowUpDays: 30, stallRepeatedUnmet: 3 };

describe('判定', () => {
  it('AC-GOAL-10: 結果は computeOutcome で決まる（GTE／LTE の境界値を含む）', () => {
    expect(computeOutcome('GTE', 3, 3)).toBe('MET');
    expect(computeOutcome('GTE', 3, 2.99)).toBe('UNMET');
    expect(computeOutcome('GTE', 3, 4)).toBe('MET');
    expect(computeOutcome('LTE', 60, 60)).toBe('MET');
    expect(computeOutcome('LTE', 60, 60.01)).toBe('UNMET');
    expect(computeOutcome('LTE', 60, 10)).toBe('MET');
    expect(computeOutcome('GTE', 0, -1)).toBe('UNMET');
  });

  it('AC-GOAL-26: effectiveValue は最新の訂正値を返し、元の判定は変わらない', () => {
    const j = judgment({ actualValue: 2 });
    const cs = [
      correction({ id: 'a', newValue: 3, createdAt: NOW - 2 * DAY }),
      correction({ id: 'b', newValue: 4, createdAt: NOW - DAY }),
      correction({ id: 'c', field: 'costNote', newValue: '週末と平日夜', createdAt: NOW }),
      correction({ id: 'd', judgmentId: 'other', newValue: 99, createdAt: NOW }),
    ];
    expect(effectiveValue(j, cs, 'actualValue')).toBe(4);
    expect(effectiveValue(j, cs, 'costNote')).toBe('週末と平日夜');
    expect(effectiveValue(j, cs, 'investedHours')).toBe(10);
    expect(effectiveValue(j, [], 'actualValue')).toBe(2);
    expect(j.actualValue).toBe(2);
    expect(j.outcome).toBe('UNMET');
  });

  it('届かなかった判定の補足は、かけた時間と失ったものの両方が必要', () => {
    expect(unmetDetailValid({ investedHours: 10, costNote: '週末' })).toBe(true);
    expect(unmetDetailValid({ investedHours: 0, costNote: 'なし' })).toBe(true);
    expect(unmetDetailValid({ investedHours: null, costNote: '週末' })).toBe(false);
    expect(unmetDetailValid({ investedHours: 10, costNote: ' ' })).toBe(false);
    expect(unmetDetailValid({ investedHours: -1, costNote: 'x' })).toBe(false);
    expect(unmetDetailValid(null)).toBe(false);
  });

  it('判定遅延は judgedAt − requestedAt', () => {
    expect(judgmentDelayMs(judgment({ requestedAt: 1000, judgedAt: 4600 }))).toBe(3600);
  });
});

describe('期限到来', () => {
  it('期限を過ぎた OPEN の段に、期限日の翌日4:00 を requestedAt とする判定待ちを作る', () => {
    const goals = [
      goal({ id: 'due', deadline: '2026-10-15' }),
      goal({ id: 'today', deadline: '2026-10-18' }),
      goal({ id: 'met', deadline: '2026-10-10', status: 'MET' }),
      goal({ id: 'already', deadline: '2026-10-12' }),
    ];
    const reqs = dueGoals(goals, [{ goalId: 'already', requestedAt: 0, detectedAt: 0 }], '2026-10-18', NOW);
    expect(reqs).toEqual([{ goalId: 'due', requestedAt: dayStart('2026-10-16'), detectedAt: NOW }]);
    expect(pendingJudgments(goals, [...reqs, { goalId: 'already', requestedAt: 0, detectedAt: 0 }]).map((g) => g.id)).toEqual([
      'already',
      'due',
    ]);
  });
});

describe('足踏み', () => {
  const ext = (id: string, goalId = 'g1') => ({
    id,
    goalId,
    previousDeadline: '2026-10-01',
    newDeadline: '2026-10-08',
    reason: '体調',
    createdAt: NOW,
  });

  it('AC-GOAL-17: 同じ段を3回延長すると EXTENSION_3X が付く（2回では付かず、MET の段にも付かない）', () => {
    const base = { judgments: [], followUps: [] };
    expect(detectStalls({ ...base, goals: [goal()], extensions: [ext('1'), ext('2')] }, SETTINGS, NOW)).toEqual([]);
    expect(detectStalls({ ...base, goals: [goal()], extensions: [ext('1'), ext('2'), ext('3')] }, SETTINGS, NOW)).toEqual([
      { goalId: 'g1', rule: 'EXTENSION_3X', n: 3 },
    ]);
    expect(
      detectStalls({ ...base, goals: [goal({ status: 'MET' })], extensions: [ext('1'), ext('2'), ext('3')] }, SETTINGS, NOW),
    ).toEqual([]);
  });

  it('AC-GOAL-18: 届かなかった判定から30日間、子も切り直しもないと NO_FOLLOW_UP_30D が付く。WITHDRAW を選んだ段には付かない', () => {
    const g = goal({ status: 'UNMET' });
    const j = judgment({ judgedAt: NOW - 30 * DAY });
    const base = { extensions: [], followUps: [] };
    expect(detectStalls({ ...base, goals: [g], judgments: [j] }, SETTINGS, NOW)).toEqual([
      { goalId: 'g1', rule: 'NO_FOLLOW_UP_30D', n: 30 },
    ]);
    // 29日では付かない
    expect(detectStalls({ ...base, goals: [g], judgments: [judgment({ judgedAt: NOW - 29 * DAY })] }, SETTINGS, NOW)).toEqual([]);
    // 30日以内に子を作っていれば付かない
    const child = goal({ id: 'c', parentId: 'g1', createdAt: NOW - 25 * DAY });
    expect(detectStalls({ ...base, goals: [g, child], judgments: [j] }, SETTINGS, NOW)).toEqual([]);
    const recut = goal({ id: 'r', recutOfId: 'g1', createdAt: NOW - 25 * DAY });
    expect(detectStalls({ ...base, goals: [g, recut], judgments: [j] }, SETTINGS, NOW)).toEqual([]);
    // 取り下げた段には付かない
    const withdrawn = { id: 'f', goalId: 'g1', choice: 'WITHDRAW' as const, createdAt: NOW - 29 * DAY };
    expect(detectStalls({ extensions: [], followUps: [withdrawn], goals: [g], judgments: [j] }, SETTINGS, NOW)).toEqual([]);
    // 刻むを選んでも子を作っていなければ付く
    const kizami = { id: 'f', goalId: 'g1', choice: 'KIZAMI' as const, createdAt: NOW - 29 * DAY };
    expect(detectStalls({ extensions: [], followUps: [kizami], goals: [g], judgments: [j] }, SETTINGS, NOW)).toHaveLength(1);
  });

  it('AC-GOAL-19: 切り直しの鎖で3回続けて届かないと REPEATED_UNMET_3X が最新の段に付く', () => {
    const chain = [
      goal({ id: 'a', status: 'UNMET', createdAt: 1 }),
      goal({ id: 'b', status: 'UNMET', recutOfId: 'a', createdAt: 2 }),
      goal({ id: 'c', status: 'UNMET', recutOfId: 'b', createdAt: 3 }),
    ];
    const base = { extensions: [], followUps: [], judgments: [] };
    expect(detectStalls({ ...base, goals: chain }, SETTINGS, NOW)).toEqual([{ goalId: 'c', rule: 'REPEATED_UNMET_3X', n: 3 }]);
    // 2回では付かない
    expect(detectStalls({ ...base, goals: chain.slice(0, 2) }, SETTINGS, NOW)).toEqual([]);
    // 途中に届いた段があれば連続しない
    const broken = [chain[0], { ...chain[1], status: 'MET' as const }, chain[2]];
    expect(detectStalls({ ...base, goals: broken }, SETTINGS, NOW)).toEqual([]);
    // 鎖の最新が判定前なら付かない
    const open = [...chain, goal({ id: 'd', status: 'OPEN', recutOfId: 'c', createdAt: 4 })];
    expect(detectStalls({ ...base, goals: open }, SETTINGS, NOW)).toEqual([]);
  });

  it('閾値は設定から渡す', () => {
    const extensions = [ext('1'), ext('2')];
    expect(detectStalls({ goals: [goal()], extensions, judgments: [], followUps: [] }, { ...SETTINGS, stallExtensionThreshold: 2 }, NOW)).toEqual([
      { goalId: 'g1', rule: 'EXTENSION_3X', n: 2 },
    ]);
  });
});

describe('較正', () => {
  it('AC-GOAL-15: 符号付き誤差が判定ごとに計算され、予想のない判定は除外される', () => {
    const goals = [
      goal({ id: 'g1', targetValue: 3 }),
      goal({ id: 'g2', targetValue: 10 }),
      goal({ id: 'g3', targetValue: 5 }),
    ];
    const judgments = [
      judgment({ id: 'j1', goalId: 'g1', actualValue: 2, judgedAt: NOW - 3 * DAY }),
      judgment({ id: 'j2', goalId: 'g2', actualValue: 12, judgedAt: NOW - 2 * DAY }),
      judgment({ id: 'j3', goalId: 'g3', actualValue: 5, judgedAt: NOW - DAY }),
    ];
    const preds = [outcomePrediction({ id: 'p1', goalId: 'g1', value: 4 }), outcomePrediction({ id: 'p2', goalId: 'g2', value: 8 })];
    const s = calibrationSeries(judgments, goals, [metric()], preds, []);
    expect(s.map((p) => p.goalId)).toEqual(['g1', 'g2']);
    expect(s[0]).toMatchObject({ predicted: 4, actual: 2, raw: 2, norm: 2 / 3, unit: '章' });
    expect(s[1]).toMatchObject({ raw: -4, norm: -0.4 });
    expect(calibrationError(s)).toBeCloseTo((2 / 3 - 0.4) / 2, 10);
  });

  it('AC-GOAL-15: LOWER_IS_BETTER では符号が反転する（正＝予想が実測より良い側）', () => {
    const m = metric({ id: 'm2', direction: 'LOWER_IS_BETTER', unit: '分' });
    const g = goal({ metricId: 'm2', comparator: 'LTE', targetValue: 60 });
    // 60分以内と予想して 45分と予想、実際は 75分（予想が良い側）→ 正
    const s = calibrationSeries([judgment({ actualValue: 75 })], [g], [m], [outcomePrediction({ value: 45 })], []);
    expect(s[0]).toMatchObject({ raw: 30, norm: 0.5 });
  });

  it('訂正後の実測値を使い、予想は期限前で最も新しいもの。閾値0でも割り算できる', () => {
    const g = goal({ targetValue: 0, deadline: '2026-10-15' });
    const preds = [
      outcomePrediction({ id: 'old', value: 1, predictedAt: dayStart('2026-10-01') }),
      outcomePrediction({ id: 'new', value: 2, predictedAt: dayStart('2026-10-15') + 1000 }),
      outcomePrediction({ id: 'late', value: 9, predictedAt: dayStart('2026-10-16') }),
    ];
    const s = calibrationSeries([judgment({ actualValue: 0 })], [g], [metric()], preds, [correction({ newValue: 1 })]);
    expect(s[0]).toMatchObject({ predicted: 2, actual: 1, raw: 1, norm: 1 });
    expect(calibrationError([])).toBeNull();
  });

  it('確率の較正、感情予想の誤差、判定遅延の中央値', () => {
    const goals = [goal({ id: 'g1' }), goal({ id: 'g2' })];
    const js = [
      judgment({ id: 'a', goalId: 'g1', outcome: 'MET', requestedAt: 0, judgedAt: 2 * 3_600_000 }),
      judgment({ id: 'b', goalId: 'g2', outcome: 'UNMET', requestedAt: 0, judgedAt: 10 * 3_600_000 }),
    ];
    const preds = [outcomePrediction({ id: 'x', goalId: 'g1', probability: 80 }), outcomePrediction({ id: 'y', goalId: 'g2', probability: 40 })];
    expect(probabilityCalibration(js, goals, preds)).toEqual({ meanProbability: 60, metRate: 0.5, n: 2 });
    expect(medianDelayHours(js)).toBe(6);
    expect(medianDelayHours([...js, judgment({ id: 'c', requestedAt: 0, judgedAt: 4 * 3_600_000 })])).toBe(4);
    expect(medianDelayHours([])).toBeNull();
    const affect = { id: 'af', goalId: 'g1', kind: 'AFFECT' as const, value: { intensity: 7, durationMin: 30 }, predictedAt: 0, sessionId: 's' };
    expect(affectErrors([affect], [{ id: 'aa', predictionId: 'af', intensity: 3, durationMin: 10, at: 0 }])).toEqual({
      intensity: 4,
      duration: 20,
      n: 1,
    });
    expect(affectErrors([affect], [])).toEqual({ intensity: null, duration: null, n: 0 });
  });
});

describe('木と検証', () => {
  it('buildTree は parentId で木を組み、切り直しは元の段の兄弟として鎖の順に並べる。depth と rootOf', () => {
    const goals = [
      goal({ id: 'root', createdAt: 1 }),
      goal({ id: 'child', parentId: 'root', createdAt: 2 }),
      goal({ id: 'recut2', parentId: 'root', recutOfId: 'recut1', createdAt: 5 }),
      goal({ id: 'recut1', parentId: 'root', recutOfId: 'child', createdAt: 4 }),
      goal({ id: 'other', parentId: 'root', createdAt: 3 }),
      goal({ id: 'grand', parentId: 'child', createdAt: 6 }),
    ];
    const tree = buildTree(goals);
    expect(tree.map((n) => n.goal.id)).toEqual(['root']);
    expect(tree[0].children.map((n) => n.goal.id)).toEqual(['child', 'recut1', 'recut2', 'other']);
    expect(flattenTree(tree).map((n) => [n.goal.id, n.depth])).toEqual([
      ['root', 0],
      ['child', 1],
      ['grand', 2],
      ['recut1', 1],
      ['recut2', 1],
      ['other', 1],
    ]);
    const byId = new Map(goals.map((g) => [g.id, g]));
    expect(depth(byId.get('grand')!, byId)).toBe(2);
    expect(rootOf(byId.get('grand')!, byId).id).toBe('root');
  });

  it('期限なし・期限が今日・決めておくことが片方だけ・予想なしの入力は通らない', () => {
    const ok = {
      metricId: 'm1',
      title: '章を3つ',
      targetValue: 3,
      comparator: 'GTE' as const,
      deadline: '2026-10-19',
      onMet: '次の章へ',
      onUnmet: '構成を見直す',
      probability: 60,
      predictedValue: 3,
    };
    expect(goalInputErrors(ok, '2026-10-18')).toEqual([]);
    expect(goalInputErrors({ ...ok, deadline: '' }, '2026-10-18')).toEqual(['deadline']);
    expect(goalInputErrors({ ...ok, deadline: '2026-10-18' }, '2026-10-18')).toEqual(['deadline']);
    expect(goalInputErrors({ ...ok, onUnmet: ' ' }, '2026-10-18')).toEqual(['onUnmet']);
    const { probability: _p, ...noPrediction } = ok;
    expect(goalInputErrors(noPrediction, '2026-10-18')).toEqual(['probability']);
    expect(goalInputErrors({ ...ok, probability: 101 }, '2026-10-18')).toEqual(['probability']);
    expect(defaultComparator('HIGHER_IS_BETTER')).toBe('GTE');
    expect(defaultComparator('LOWER_IS_BETTER')).toBe('LTE');
  });
});
