import { beforeEach, describe, expect, it } from 'vitest';
import { copyByKey } from '../../copy/fill';
import { dayStart } from '../../domain/dates';
import { effectiveValue } from '../../domain/goals/judgment';
import type { GoalInput } from '../../domain/goals/goal';
import { db } from '../db';
import { verifyDbLedger } from '../ledger';
import {
  addPrediction,
  chooseFollowUp,
  correctJudgment,
  createChildGoal,
  createGoal,
  createRecutGoal,
  detectDueGoals,
  dismissStallFlag,
  extendDeadline,
  hideGoal,
  judge,
  recordMeasurement,
  saveMetric,
  syncStallFlags,
} from '../repo/goals';
import { codeOfRejection, NOW, resetSeeded } from './helpers';

const DAY = 86_400_000;
let metricId = '';

function input(p: Partial<GoalInput> = {}): GoalInput {
  return {
    metricId,
    title: '章を3つ書く',
    targetValue: 3,
    comparator: 'GTE',
    deadline: '2026-10-25',
    onMet: '次の章の構成を作る',
    onUnmet: '1章だけに絞る',
    probability: 60,
    predictedValue: 3,
    ...p,
  };
}

/** 期限を過ぎた段（作成は期限の10日前）を作る */
async function pastGoal(p: Partial<GoalInput> = {}) {
  return createGoal(input({ deadline: '2026-10-15', ...p }), dayStart('2026-10-05'));
}

async function counts() {
  return { goals: await db.goals.count(), commitments: await db.commitments.count(), predictions: await db.predictions.count() };
}

beforeEach(async () => {
  await resetSeeded({ onboarded: true });
  metricId = (await saveMetric({ name: '書いた章数', unit: '章', direction: 'HIGHER_IS_BETTER', collectionMethod: 'ファイルを数える', verifiable: true }, NOW)).id;
});

describe('段の作成', () => {
  it('AC-GOAL-01: 期限なしで createGoal すると VALIDATION になり、段も作られない', async () => {
    expect(await codeOfRejection(createGoal(input({ deadline: '' }), NOW))).toBe('VALIDATION');
    expect(await codeOfRejection(createGoal(input({ deadline: undefined as unknown as string }), NOW))).toBe('VALIDATION');
    expect(await codeOfRejection(createGoal(input({ deadline: '2026-10-18' }), NOW))).toBe('VALIDATION');
    expect(await counts()).toEqual({ goals: 0, commitments: 0, predictions: 0 });
  });

  it('AC-GOAL-02: 事前コミットが1件以下の createGoal は VALIDATION になり、段・予想・コミットのどれも作られない', async () => {
    let caught: unknown;
    try {
      await createGoal(input({ onUnmet: '' }), NOW);
    } catch (e) {
      caught = e;
    }
    expect((caught as { code: string }).code).toBe('VALIDATION');
    expect(copyByKey((caught as { copyKey: string }).copyKey)).toBe('届いた場合と届かなかった場合の、両方を書いてください');
    expect(await codeOfRejection(createGoal(input({ onMet: ' ', onUnmet: ' ' }), NOW))).toBe('VALIDATION');
    expect(await counts()).toEqual({ goals: 0, commitments: 0, predictions: 0 });
  });

  it('段・事前コミット2件・OUTCOME 予想1件を台帳つきで作る', async () => {
    const g = await createGoal(input(), NOW);
    expect(g).toMatchObject({ status: 'OPEN', parentId: null, recutOfId: null, hiddenAt: null });
    expect((await db.commitments.toArray()).map((c) => c.condition).sort()).toEqual(['ON_MET', 'ON_UNMET']);
    expect(await db.predictions.toArray()).toMatchObject([{ kind: 'OUTCOME', value: { probability: 60, value: 3 } }]);
    expect(await verifyDbLedger()).toEqual({ ok: true, count: 3 });
  });

  it('指標は取得方法が空なら登録できない', async () => {
    expect(
      await codeOfRejection(saveMetric({ name: '体重', unit: 'kg', direction: 'LOWER_IS_BETTER', collectionMethod: ' ', verifiable: true }, NOW)),
    ).toBe('VALIDATION');
  });
});

describe('期限到来と判定', () => {
  it('AC-GOAL-03: 期限を過ぎた段が detectDueGoals の後に判定待ちに現れ、requestedAt が期限日の翌日4:00', async () => {
    const g = await pastGoal();
    await createGoal(input({ deadline: '2026-10-25' }), NOW);
    const created = await detectDueGoals('2026-10-18', NOW);
    expect(created).toEqual([{ goalId: g.id, requestedAt: dayStart('2026-10-16'), detectedAt: NOW }]);
    expect(new Date(created[0].requestedAt).getHours()).toBe(4);
    expect(await detectDueGoals('2026-10-18', NOW + 1000)).toEqual([]);
    expect(await db.judgmentRequests.count()).toBe(1);
  });

  it('AC-GOAL-04: 判定済みの段に2件目の判定を送ると CONFLICT', async () => {
    const g = await pastGoal();
    await detectDueGoals('2026-10-18', NOW);
    await judge(g.id, 3, null, { enforced: true }, NOW);
    expect(await codeOfRejection(judge(g.id, 4, null, { enforced: true }, NOW + 1000))).toBe('CONFLICT');
    expect(await db.judgments.count()).toBe(1);
  });

  it('AC-GOAL-05: judgments テーブルを直接 update すると例外になる', async () => {
    const g = await pastGoal();
    const j = await judge(g.id, 3, null, { enforced: true }, NOW);
    expect(await codeOfRejection(db.judgments.update(j.id, { outcome: 'UNMET' }))).toBe('IMMUTABLE');
    expect((await db.judgments.get(j.id))?.outcome).toBe('MET');
  });

  it('AC-GOAL-10: judge に結果の引数はなく、結果は閾値との比較で決まる。Measurement と状態の更新も1回で行う', async () => {
    const g = await pastGoal();
    await detectDueGoals('2026-10-18', NOW);
    const j = await judge(g.id, 3, null, { enforced: false }, NOW);
    expect(j).toMatchObject({ outcome: 'MET', actualValue: 3, requestedAt: dayStart('2026-10-16'), detectedAt: NOW, judgedAt: NOW, enforced: false });
    expect((await db.goals.get(g.id))?.status).toBe('MET');
    expect(await db.measurements.toArray()).toMatchObject([{ metricId, value: 3, source: 'judgment' }]);
    expect(judge.length).toBe(5);
  });

  it('AC-GOAL-11: 届かなかった判定で、かけた時間か失ったものが空なら VALIDATION', async () => {
    const g = await pastGoal();
    expect(await codeOfRejection(judge(g.id, 2, null, { enforced: true }, NOW))).toBe('VALIDATION');
    expect(await codeOfRejection(judge(g.id, 2, { investedHours: null, costNote: '週末' }, { enforced: true }, NOW))).toBe('VALIDATION');
    expect(await codeOfRejection(judge(g.id, 2, { investedHours: 10, costNote: ' ' }, { enforced: true }, NOW))).toBe('VALIDATION');
    expect(await db.judgments.count()).toBe(0);
    expect((await db.goals.get(g.id))?.status).toBe('OPEN');
    const j = await judge(g.id, 2, { investedHours: 10, costNote: '週末' }, { enforced: true }, NOW);
    expect(j).toMatchObject({ outcome: 'UNMET', investedHours: 10, costNote: '週末' });
  });

  it('期限前の段は判定できない', async () => {
    const g = await createGoal(input(), NOW);
    expect(await codeOfRejection(judge(g.id, 3, null, { enforced: true }, NOW))).toBe('CONFLICT');
  });

  it('AC-GOAL-26: 判定の訂正は追記され、effectiveValue が最新の訂正値を返し、元の判定は変わらない', async () => {
    const g = await pastGoal();
    const j = await judge(g.id, 2, { investedHours: 10, costNote: '週末' }, { enforced: true }, NOW);
    await correctJudgment(j.id, 'actualValue', 3, '数え間違い', NOW + 1000);
    await correctJudgment(j.id, 'actualValue', 4, 'もう一度数えた', NOW + 2000);
    expect(await codeOfRejection(correctJudgment(j.id, 'actualValue', 5, ' ', NOW))).toBe('VALIDATION');
    const cs = await db.judgmentCorrections.toArray();
    expect(cs).toHaveLength(2);
    const stored = (await db.judgments.get(j.id))!;
    expect(effectiveValue(stored, cs, 'actualValue')).toBe(4);
    expect(stored).toMatchObject({ actualValue: 2, outcome: 'UNMET' });
    expect((await db.goals.get(g.id))?.status).toBe('UNMET');
  });
});

describe('刻む・切り直す', () => {
  it('AC-GOAL-06: 届かなかった段から子を作っても、親の status は UNMET のまま', async () => {
    const parent = await pastGoal();
    await judge(parent.id, 1, { investedHours: 5, costNote: '時間' }, { enforced: true }, NOW);
    const child = await createChildGoal(parent.id, input({ title: '1章だけ書く', targetValue: 1 }), NOW);
    expect(child).toMatchObject({ parentId: parent.id, recutOfId: null, status: 'OPEN' });
    expect((await db.goals.get(parent.id))?.status).toBe('UNMET');
    const recut = await createRecutGoal(parent.id, input({ title: '章を2つ', targetValue: 2 }), NOW);
    expect(recut).toMatchObject({ parentId: null, recutOfId: parent.id });
    expect((await db.goals.get(parent.id))?.status).toBe('UNMET');
  });

  it('AC-GOAL-07: OPEN の段から子を作ろうとすると CONFLICT', async () => {
    const open = await createGoal(input(), NOW);
    expect(await codeOfRejection(createChildGoal(open.id, input(), NOW))).toBe('CONFLICT');
    expect(await codeOfRejection(createRecutGoal(open.id, input(), NOW))).toBe('CONFLICT');
    expect(await db.goals.count()).toBe(1);
  });

  it('届かなかった段の追跡の選択は1回だけ追記できる', async () => {
    const g = await pastGoal();
    await judge(g.id, 1, { investedHours: 5, costNote: '時間' }, { enforced: true }, NOW);
    await chooseFollowUp(g.id, 'KIZAMI', NOW);
    expect(await codeOfRejection(chooseFollowUp(g.id, 'WITHDRAW', NOW))).toBe('CONFLICT');
  });
});

describe('延長', () => {
  it('AC-GOAL-08: 理由なしの延長は VALIDATION になり、Goal.deadline も変わらない', async () => {
    const g = await createGoal(input(), NOW);
    expect(await codeOfRejection(extendDeadline(g.id, '2026-11-01', '  ', '2026-10-18', NOW))).toBe('VALIDATION');
    expect((await db.goals.get(g.id))?.deadline).toBe('2026-10-25');
    expect(await db.deadlineExtensions.count()).toBe(0);
    const next = await extendDeadline(g.id, '2026-11-01', '体調を崩した', '2026-10-18', NOW);
    expect(next.deadline).toBe('2026-11-01');
    expect(await db.deadlineExtensions.toArray()).toMatchObject([{ previousDeadline: '2026-10-25', newDeadline: '2026-11-01', reason: '体調を崩した' }]);
    expect(await codeOfRejection(extendDeadline(g.id, '2026-10-30', '短く', '2026-10-18', NOW))).toBe('VALIDATION');
  });

  it('AC-GOAL-09: 期限日を過ぎた段の延長は CONFLICT（期限日の当日はできる）', async () => {
    const g = await createGoal(input({ deadline: '2026-10-19' }), NOW);
    expect(await codeOfRejection(extendDeadline(g.id, '2026-10-26', '理由', '2026-10-20', NOW + 2 * DAY))).toBe('CONFLICT');
    expect((await db.goals.get(g.id))?.deadline).toBe('2026-10-19');
    await extendDeadline(g.id, '2026-10-26', '理由', '2026-10-19', NOW + DAY);
  });
});

describe('予想', () => {
  it('AC-GOAL-14: 期限を過ぎた段への予想の追加が ORDER_VIOLATION', async () => {
    const g = await pastGoal();
    expect(await codeOfRejection(addPrediction(g.id, 'OUTCOME', { probability: 50, value: 2 }, null, NOW))).toBe('ORDER_VIOLATION');
    const open = await createGoal(input(), NOW);
    await addPrediction(open.id, 'OUTCOME', { probability: 70, value: 3 }, null, NOW);
    expect(await db.predictions.where('goalId').equals(open.id).count()).toBe(2);
  });

  it('判定済みの段にも予想は足せない', async () => {
    const g = await pastGoal();
    await judge(g.id, 3, null, { enforced: true }, NOW);
    expect(await codeOfRejection(addPrediction(g.id, 'AFFECT', { intensity: 3, durationMin: 5 }, null, NOW))).toBe('ORDER_VIOLATION');
  });
});

describe('足踏みと非表示', () => {
  it('AC-GOAL-20: 却下したフラグは一覧から消えるがレコードは残り、再検出でも作り直されない', async () => {
    const g = await createGoal(input({ deadline: '2026-10-19' }), NOW);
    for (const [d, r] of [['2026-10-20', 'a'], ['2026-10-21', 'b'], ['2026-10-22', 'c']]) {
      await extendDeadline(g.id, d, r, '2026-10-18', NOW);
    }
    const created = await syncStallFlags('2026-10-18', NOW);
    expect(created).toMatchObject([{ goalId: g.id, rule: 'EXTENSION_3X', dismissedAt: null }]);
    await dismissStallFlag(created[0].id, NOW + 1000);
    await dismissStallFlag(created[0].id, NOW + 9000);
    const active = (await db.stallFlags.toArray()).filter((f) => f.dismissedAt === null);
    expect(active).toEqual([]);
    expect(await db.stallFlags.get(created[0].id)).toMatchObject({ dismissedAt: NOW + 1000 });
    expect(await syncStallFlags('2026-10-18', NOW + 2000)).toEqual([]);
    expect(await db.stallFlags.count()).toBe(1);
  });

  it('AC-GOAL-25: 最上位の段の非表示が CONFLICT。子の段は非表示にできる', async () => {
    const root = await pastGoal();
    expect(await codeOfRejection(hideGoal(root.id, NOW))).toBe('CONFLICT');
    await judge(root.id, 1, { investedHours: 1, costNote: 'x' }, { enforced: true }, NOW);
    const child = await createChildGoal(root.id, input(), NOW);
    await hideGoal(child.id, NOW);
    expect((await db.goals.get(child.id))?.hiddenAt).toBe(NOW);
    expect((await db.goals.get(root.id))?.hiddenAt).toBeNull();
  });

  it('実測は追記専用で記録される', async () => {
    const m = await recordMeasurement({ metricId, value: 2, measuredAt: NOW, note: null }, NOW);
    expect(m).toMatchObject({ source: 'manual', value: 2 });
    expect(await codeOfRejection(db.measurements.delete(m.id))).toBe('IMMUTABLE');
  });
});

describe('起動時の処理（§6.3.4 の 3, 4）', () => {
  it('onLaunch で期限を過ぎた段の判定待ちと、足踏みのフラグを作る', async () => {
    const { onLaunch } = await import('../init');
    const g = await pastGoal();
    const open = await createGoal(input({ deadline: '2026-10-19' }), NOW);
    for (const [d, r] of [['2026-10-20', 'a'], ['2026-10-21', 'b'], ['2026-10-22', 'c']]) {
      await extendDeadline(open.id, d, r, '2026-10-18', NOW);
    }
    await onLaunch(NOW);
    expect(await db.judgmentRequests.toArray()).toMatchObject([{ goalId: g.id }]);
    expect(await db.stallFlags.toArray()).toMatchObject([{ goalId: open.id, rule: 'EXTENSION_3X' }]);
  });
});
