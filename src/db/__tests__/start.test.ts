import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { verifyDbLedger } from '../ledger';
import {
  carryOverTask,
  closeTask,
  createTask,
  endSession,
  interruptSession,
  recordStuck,
  saveDailyCheck,
  saveEscapeLog,
  startSession,
  sweepAbandoned,
} from '../repo/start';
import { createGoal, saveMetric } from '../repo/goals';
import { codeOfRejection, NOW, resetSeeded, taskInput } from './helpers';

const MIN = 60_000;
const input = taskInput;

beforeEach(async () => {
  await resetSeeded({ onboarded: true });
});

describe('ラフ登録', () => {
  it('AC-START-01: B 条件では3項目のどれかが空なら保存できない', async () => {
    for (const p of [{ title: '' }, { roughVersion: '' }, { firstAction: ' ' }, { roughVersion: null }]) {
      expect(await codeOfRejection(createTask(input(p), true, NOW))).toBe('VALIDATION');
    }
    expect(await db.tasks.count()).toBe(0);
    const t = await createTask(input(), true, NOW);
    expect(t).toMatchObject({ title: '卒論の序章', roughVersion: '見出しだけ', firstAction: 'エディタを開く', planHistory: [] });
  });

  it('AC-START-01: A 条件では title だけで保存でき、roughVersion と firstAction は null', async () => {
    const t = await createTask(input({ roughVersion: '', firstAction: null }), false, NOW);
    expect(t).toMatchObject({ title: '卒論の序章', roughVersion: null, firstAction: null });
    const t2 = await createTask(input({ roughVersion: '入れても', firstAction: '捨てる' }), false, NOW);
    expect(t2).toMatchObject({ roughVersion: null, firstAction: null });
    expect(await codeOfRejection(createTask(input({ title: '' }), false, NOW))).toBe('VALIDATION');
  });
});

describe('セッション', () => {
  it('AC-START-05: 「続ける」で前のセッションが continued になり、同じやることの新しいセッションが作られる', async () => {
    const t = await createTask(input(), true, NOW);
    const s = await startSession(t.id, true, null, NOW);
    const nextId = await endSession(s.id, 'continue', null, null, NOW + 10 * MIN);
    expect(await db.sessions.get(s.id)).toMatchObject({ outcome: 'continued', endedAt: NOW + 10 * MIN });
    const next = await db.sessions.get(nextId ?? '');
    expect(next).toMatchObject({ taskId: t.id, startedAt: NOW + 10 * MIN, endedAt: null, outcome: null });
    expect(await db.sessions.count()).toBe(2);
  });

  it('AC-START-06: 詰まりで fill／research5 を選んでもセッションは止まらず、StuckLog が1件ずつ増える', async () => {
    const t = await createTask(input(), true, NOW);
    const s = await startSession(t.id, true, null, NOW);
    await recordStuck(s.id, '構成が決まらない', 'fill', NOW + MIN);
    expect(await db.stuckLogs.count()).toBe(1);
    await recordStuck(s.id, '用語', 'research5', NOW + 2 * MIN);
    expect(await db.stuckLogs.count()).toBe(2);
    expect(await db.sessions.get(s.id)).toMatchObject({ endedAt: null, outcome: null });
    expect((await db.stuckLogs.toArray()).map((l) => l.choice).sort()).toEqual(['fill', 'research5']);
  });

  it('AC-START-07: stop を選ぶとセッションが stopped になり、終了画面へ移る指示を返す', async () => {
    const t = await createTask(input(), true, NOW);
    const s = await startSession(t.id, true, null, NOW);
    const effects = await recordStuck(s.id, '資料がない', 'stop', NOW + 3 * MIN);
    expect(effects.goTo).toBe('end');
    expect(await db.sessions.get(s.id)).toMatchObject({ outcome: 'stopped', endedAt: NOW + 3 * MIN });
    expect(await db.stuckLogs.count()).toBe(1);
  });

  it('詰まりの1行は必須で80文字以内', async () => {
    const t = await createTask(input(), true, NOW);
    const s = await startSession(t.id, true, null, NOW);
    expect(await codeOfRejection(recordStuck(s.id, ' ', 'fill', NOW))).toBe('VALIDATION');
    expect(await codeOfRejection(recordStuck(s.id, 'あ'.repeat(81), 'fill', NOW))).toBe('VALIDATION');
  });

  it('中断で stopped。新しく始めると進行中のセッションは stopped で閉じる', async () => {
    const t = await createTask(input(), true, NOW);
    const s1 = await startSession(t.id, true, null, NOW);
    const s2 = await startSession(t.id, true, null, NOW + MIN);
    expect(await db.sessions.get(s1.id)).toMatchObject({ outcome: 'stopped', endedAt: NOW + MIN });
    await interruptSession(s2.id, NOW + 2 * MIN);
    expect(await db.sessions.get(s2.id)).toMatchObject({ outcome: 'stopped', endedAt: NOW + 2 * MIN });
  });

  it('やめる: B 条件では次の一手が必須、A 条件では空でよい。次の一手はやることに残る', async () => {
    const t = await createTask(input(), true, NOW);
    const s = await startSession(t.id, true, null, NOW);
    expect(await codeOfRejection(endSession(s.id, 'stop', ' ', null, NOW + 10 * MIN))).toBe('VALIDATION');
    await endSession(s.id, 'stop', '見出しを3つ足す', null, NOW + 10 * MIN);
    expect(await db.sessions.get(s.id)).toMatchObject({ outcome: 'stopped' });
    expect((await db.tasks.get(t.id))?.nextStep).toBe('見出しを3つ足す');

    const a = await startSession(t.id, false, null, NOW + 20 * MIN);
    await endSession(a.id, 'stop', null, null, NOW + 30 * MIN);
    expect((await db.tasks.get(t.id))?.nextStep).toBeNull();
  });

  it('AC-START-08: 40分以上前に開始された未終了のセッションが abandoned（endedAt = 開始＋10分）になる', async () => {
    const t = await createTask(input(), true, NOW);
    const old = await startSession(t.id, true, null, NOW - 40 * MIN);
    await db.sessions.add({ ...old, id: 'recent', startedAt: NOW - 39 * MIN });
    const closed = await sweepAbandoned(NOW);
    expect(closed).toEqual([old.id]);
    expect(await db.sessions.get(old.id)).toMatchObject({ outcome: 'abandoned', endedAt: NOW - 30 * MIN });
    expect(await db.sessions.get('recent')).toMatchObject({ endedAt: null });
    expect(await sweepAbandoned(NOW)).toEqual([]);
  });

  it('感情予想があれば AFFECT 予想を台帳つきで追記し、終了で実際の値を1回だけ追記する', async () => {
    const m = await saveMetric({ name: '章数', unit: '章', direction: 'HIGHER_IS_BETTER', collectionMethod: '数える', verifiable: true }, NOW);
    const g = await createGoal(
      { metricId: m.id, title: '章', targetValue: 3, comparator: 'GTE', deadline: '2026-10-25', onMet: 'a', onUnmet: 'b', probability: 50, predictedValue: 3 },
      NOW,
    );
    const t = await createTask(input({ goalId: g.id }), true, NOW);
    const s = await startSession(t.id, true, { intensity: 6, durationMin: 10 }, NOW);
    const p = await db.predictions.get(s.affectPredictionId ?? '');
    expect(p).toMatchObject({ goalId: g.id, kind: 'AFFECT', value: { intensity: 6, durationMin: 10 }, sessionId: s.id });
    await endSession(s.id, 'continue', null, { intensity: 3, durationMin: 5 }, NOW + 10 * MIN);
    expect(await db.affectActuals.count()).toBe(1);
    // 段の作成（コミット2件と OUTCOME 予想）＋ AFFECT 予想 ＋ 実際の値
    expect(await verifyDbLedger()).toEqual({ ok: true, count: 5 });
  });

  it('期限を過ぎた段に紐づいたやることでは、感情予想つきの開始は ORDER_VIOLATION', async () => {
    const m = await saveMetric({ name: '章数', unit: '章', direction: 'HIGHER_IS_BETTER', collectionMethod: '数える', verifiable: true }, NOW);
    const g = await createGoal(
      { metricId: m.id, title: '章', targetValue: 3, comparator: 'GTE', deadline: '2026-10-15', onMet: 'a', onUnmet: 'b', probability: 50, predictedValue: 3 },
      NOW - 10 * 1440 * MIN,
    );
    const t = await createTask(input({ goalId: g.id }), true, NOW);
    expect(await codeOfRejection(startSession(t.id, true, { intensity: 6, durationMin: 10 }, NOW))).toBe('ORDER_VIOLATION');
    await startSession(t.id, true, null, NOW);
  });
});

describe('持ち越しと片づけ', () => {
  it('AC-START-11: 持ち越しで plannedFor が今日になり、元の日付が planHistory に残る', async () => {
    const t = await createTask(input({ plannedFor: '2026-10-16' }), true, NOW);
    const moved = await carryOverTask(t.id, '2026-10-18', NOW);
    expect(moved).toMatchObject({ plannedFor: '2026-10-18', planHistory: ['2026-10-16'] });
    const again = await carryOverTask(t.id, '2026-10-19', NOW);
    expect(again).toMatchObject({ plannedFor: '2026-10-19', planHistory: ['2026-10-16', '2026-10-18'] });
  });

  it('片づけるで archivedAt と closedReason が入る', async () => {
    const t = await createTask(input(), true, NOW);
    expect(await closeTask(t.id, 'dropped', NOW)).toMatchObject({ archivedAt: NOW, closedReason: 'dropped' });
  });
});

describe('逃避ログと1日のしめ', () => {
  it('AC-START-09: 逃避ログは全項目が空でも保存できる', async () => {
    const log = await saveEscapeLog({}, NOW);
    expect(log).toMatchObject({ at: NOW, taskId: null, sessionId: null, priorState: null, target: null, enjoyed: null });
    expect(await db.escapeLogs.count()).toBe(1);
  });

  it('AC-START-10: 1日のしめは同じ論理日で上書きされる', async () => {
    await saveDailyCheck({ pendingWorry: true, consumptionMin: 120, plannedTaskExists: false }, '2026-10-18', NOW);
    await saveDailyCheck({ pendingWorry: false, consumptionMin: 30, plannedTaskExists: true }, '2026-10-18', NOW + MIN);
    const all = await db.dailyChecks.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ date: '2026-10-18', pendingWorry: false, consumptionMin: 30, answeredAt: NOW + MIN });
  });

  it('AC-START-10: consumptionMin が 0〜1440 の整数以外を拒否する', async () => {
    const save = (m: number) =>
      saveDailyCheck({ pendingWorry: false, consumptionMin: m, plannedTaskExists: false }, '2026-10-18', NOW);
    for (const m of [-1, 1441, 10.5, Number.NaN]) expect(await codeOfRejection(save(m))).toBe('VALIDATION');
    expect(await db.dailyChecks.count()).toBe(0);
    for (const m of [0, 1440]) await save(m);
    expect(await db.dailyChecks.count()).toBe(1);
  });
});
