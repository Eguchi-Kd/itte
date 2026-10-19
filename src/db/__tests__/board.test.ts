import { beforeEach, describe, expect, it } from 'vitest';
import { copyByKey } from '../../copy/fill';
import { db } from '../db';
import {
  deleteBoardItem,
  restoreBoardItem,
  saveBoardItem,
  saveEvaluationFunction,
  saveTrigger,
  setBoardItemStatus,
  setTriggerActive,
} from '../repo/board';
import { codeOfRejection, NOW, resetSeeded } from './helpers';

beforeEach(async () => {
  await resetSeeded({ onboarded: true });
});

describe('評価関数', () => {
  it('AC-BOARD-04: 期間が重なる2件目の保存が PERIOD_OVERLAP になり、日本語のエラー文を引ける', async () => {
    await saveEvaluationFunction({ metric: '週に書いた章数', avoid: [], startDate: '2026-10-01', endDate: '2026-12-31' }, NOW);
    let caught: unknown;
    try {
      await saveEvaluationFunction({ metric: '睡眠', avoid: [], startDate: '2026-12-31', endDate: '2027-03-31' }, NOW);
    } catch (e) {
      caught = e;
    }
    const err = caught as { code: string; copyKey: string };
    expect(err.code).toBe('PERIOD_OVERLAP');
    expect(copyByKey(err.copyKey)).toBe('期間が、すでにある評価関数と重なっています');
    expect(await db.evaluationFunctions.count()).toBe(1);
    await saveEvaluationFunction({ metric: '睡眠', avoid: [], startDate: '2027-01-01', endDate: '2027-03-31' }, NOW);
    expect(await db.evaluationFunctions.count()).toBe(2);
  });

  it('同じ評価関数の編集は自分と重なっても保存できる。避けたいことは3件まで、期間は開始より後', async () => {
    const e = await saveEvaluationFunction({ metric: '章数', avoid: ['夜更かし'], startDate: '2026-10-01', endDate: '2026-12-31' }, NOW);
    await saveEvaluationFunction({ ...e, metric: '章の数' }, NOW);
    expect((await db.evaluationFunctions.get(e.id))?.metric).toBe('章の数');
    expect(
      await codeOfRejection(
        saveEvaluationFunction({ metric: 'x', avoid: ['a', 'b', 'c', 'd'], startDate: '2027-01-01', endDate: '2027-02-01' }, NOW),
      ),
    ).toBe('VALIDATION');
    expect(
      await codeOfRejection(saveEvaluationFunction({ metric: 'x', avoid: [], startDate: '2027-02-01', endDate: '2027-02-01' }, NOW)),
    ).toBe('VALIDATION');
  });
});

describe('手番トリガー', () => {
  it('AC-BOARD-06: 有効なトリガーが5件あるとき、6件目の有効化が LIMIT_EXCEEDED になる', async () => {
    for (let i = 0; i < 5; i++) await saveTrigger({ conditionText: `条件${i}`, active: true }, NOW + i);
    const sixth = await saveTrigger({ conditionText: '6件目', active: false }, NOW);
    expect(await codeOfRejection(setTriggerActive(sixth.id, true, NOW))).toBe('LIMIT_EXCEEDED');
    expect(await codeOfRejection(saveTrigger({ conditionText: '7件目', active: true }, NOW))).toBe('LIMIT_EXCEEDED');
    expect((await db.turnTriggers.toArray()).filter((t) => t.active)).toHaveLength(5);

    const first = (await db.turnTriggers.toArray()).find((t) => t.conditionText === '条件0')!;
    await setTriggerActive(first.id, false, NOW);
    await setTriggerActive(sixth.id, true, NOW);
    expect((await db.turnTriggers.toArray()).filter((t) => t.active)).toHaveLength(5);
    // 既に有効なものを有効のまま保存し直すのは数えない
    await saveTrigger({ id: sixth.id, conditionText: '6件目（直した）', active: true }, NOW);
  });
});

describe('盤面の項目', () => {
  it('保存・済みにする・削除と取り消し', async () => {
    const item = await saveBoardItem({ type: 'deadline', title: 'ゼミ発表', dueDate: '2026-10-20' }, NOW);
    expect(item).toMatchObject({ status: 'open', source: 'manual', externalUid: null });
    await setBoardItemStatus(item.id, 'done', NOW);
    expect((await db.boardItems.get(item.id))?.status).toBe('done');
    const removed = await deleteBoardItem(item.id);
    expect(await db.boardItems.count()).toBe(0);
    await restoreBoardItem(removed!);
    expect(await db.boardItems.get(item.id)).toMatchObject({ title: 'ゼミ発表', status: 'done' });
    expect(await codeOfRejection(saveBoardItem({ type: 'project', title: ' ', dueDate: null }, NOW))).toBe('VALIDATION');
  });
});
