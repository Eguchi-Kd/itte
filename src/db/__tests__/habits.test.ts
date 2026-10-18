import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { updateSettings } from '../repo/common';
import {
  recordDone,
  recordMissed,
  revertLog,
  saveCountermeasure,
  saveHabit,
  saveReasonTag,
  saveWeeklyCheck,
  setHabitStatus,
  undoLog,
} from '../repo/habits';
import { codeOfRejection, habitDraft as draft, NOW, resetSeeded } from './helpers';

const DAY = 86400000;

beforeEach(async () => {
  await resetSeeded({ onboarded: true });
});

describe('記録', () => {
  it('AC-HAB-03: 同じ日に recordDone を2回呼ぶと、記録は1件のまま amount が加算される', async () => {
    const h = await saveHabit(draft(), NOW);
    await recordDone(h.id, '2026-10-18', undefined, NOW);
    await recordDone(h.id, '2026-10-18', 5, NOW + 1000);
    const logs = await db.habitLogs.where('habitId').equals(h.id).toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ date: '2026-10-18', done: true, amount: 15, recordedAt: NOW + 1000 });
  });

  it('AC-HAB-03: 記録なしの日に recordDone すると、加算ではなく done=true と量になる', async () => {
    const h = await saveHabit(draft(), NOW);
    const tag = (await db.reasonTags.toArray())[0];
    await recordMissed(h.id, '2026-10-17', [tag.id], null, NOW);
    await recordDone(h.id, '2026-10-17', undefined, NOW);
    const logs = await db.habitLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ done: true, amount: 10, reasonTagIds: [] });
  });

  it('AC-HAB-04: 4日前と明日の日付への記録が OUT_OF_WINDOW で拒否される', async () => {
    const h = await saveHabit(draft(), NOW);
    for (const date of ['2026-10-14', '2026-10-19']) {
      expect(await codeOfRejection(recordDone(h.id, date, undefined, NOW))).toBe('OUT_OF_WINDOW');
      expect(await codeOfRejection(recordMissed(h.id, date, [], null, NOW))).toBe('OUT_OF_WINDOW');
      expect(await codeOfRejection(undoLog(h.id, date, NOW))).toBe('OUT_OF_WINDOW');
    }
    expect(await db.habitLogs.count()).toBe(0);
  });

  it('AC-HAB-04: 今日と3日前までは受け付ける（境界は論理日の4時）', async () => {
    const h = await saveHabit(draft(), NOW);
    for (const date of ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']) {
      await recordDone(h.id, date, undefined, NOW);
    }
    expect(await db.habitLogs.count()).toBe(4);
    // 10/19 03:59 はまだ 10/18。10/19 は未来日、10/15 は3日前
    const early = new Date(2026, 9, 19, 3, 59).getTime();
    expect(await codeOfRejection(recordDone(h.id, '2026-10-19', undefined, early))).toBe('OUT_OF_WINDOW');
    await recordDone(h.id, '2026-10-15', undefined, early);
    const after4 = new Date(2026, 9, 19, 4, 0).getTime();
    expect(await codeOfRejection(recordDone(h.id, '2026-10-15', undefined, after4))).toBe('OUT_OF_WINDOW');
  });

  it('undoLog はその日の記録を消し、revertLog は変更前に戻す', async () => {
    const h = await saveHabit(draft(), NOW);
    const first = await recordDone(h.id, '2026-10-18', undefined, NOW);
    expect(first.previous).toBeNull();
    const second = await recordDone(h.id, '2026-10-18', 3, NOW);
    await revertLog(h.id, '2026-10-18', second.previous, NOW);
    expect((await db.habitLogs.toArray())[0].amount).toBe(10);
    await revertLog(h.id, '2026-10-18', first.previous, NOW);
    expect(await db.habitLogs.count()).toBe(0);

    await recordDone(h.id, '2026-10-16', undefined, NOW);
    expect((await undoLog(h.id, '2026-10-16', NOW))?.date).toBe('2026-10-16');
    expect(await db.habitLogs.count()).toBe(0);
  });

  it('recordMissed は done=false, amount=0 で理由タグを残す', async () => {
    const h = await saveHabit(draft(), NOW);
    const tags = await db.reasonTags.orderBy('order').toArray();
    await recordDone(h.id, '2026-10-17', undefined, NOW);
    await recordMissed(h.id, '2026-10-17', [tags[1].id, tags[1].id], '  ', NOW);
    const logs = await db.habitLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ done: false, amount: 0, reasonTagIds: [tags[1].id], memo: null });
  });
});

describe('習慣の保存と状態', () => {
  it('作成で startedOn・amountChangedOn が今日、status が active', async () => {
    const h = await saveHabit(draft({ name: '  英単語 ' }), NOW);
    expect(h).toMatchObject({ name: '英単語', status: 'active', startedOn: '2026-10-18', amountChangedOn: '2026-10-18' });
    expect(await db.habits.count()).toBe(1);
  });

  it('量を変えたら amountChangedOn を今日にする。量が同じなら変えない', async () => {
    const h = await saveHabit(draft(), NOW - 20 * DAY);
    expect(h.amountChangedOn).toBe('2026-09-28');
    const same = await saveHabit({ ...draft({ place: '図書館' }), id: h.id }, NOW);
    expect(same.amountChangedOn).toBe('2026-09-28');
    const changed = await saveHabit({ ...draft({ amount: 12 }), id: h.id }, NOW);
    expect(changed.amountChangedOn).toBe('2026-10-18');
    expect(changed.startedOn).toBe('2026-09-28');
  });

  it('検証に通らない入力は VALIDATION（regret では環境設計メモ、meaning では目的が必須）', async () => {
    expect(await codeOfRejection(saveHabit(draft({ minAmount: 11 }), NOW))).toBe('VALIDATION');
    expect(await codeOfRejection(saveHabit(draft({ schedule: { days: [], time: '07:00', cue: null } }), NOW))).toBe(
      'VALIDATION',
    );
    await updateSettings({ persona: 'regret' }, NOW);
    expect(await codeOfRejection(saveHabit(draft(), NOW))).toBe('VALIDATION');
    await updateSettings({ persona: 'meaning' }, NOW);
    expect(await codeOfRejection(saveHabit(draft(), NOW))).toBe('VALIDATION');
    await saveHabit(draft({ purpose: '読めるようになる' }), NOW);
    expect(await db.habits.count()).toBe(1);
  });

  it('setHabitStatus は graduated／ended で endedOn を今日に、active で消す', async () => {
    const h = await saveHabit(draft(), NOW);
    const g = await setHabitStatus(h.id, 'graduated', null, NOW);
    expect(g).toMatchObject({ status: 'graduated', endedOn: '2026-10-18' });
    const a = await setHabitStatus(h.id, 'active', null, NOW);
    expect(a).toMatchObject({ status: 'active', endedOn: null, endNote: null });
    const e = await setHabitStatus(h.id, 'ended', '別の形にする', NOW);
    expect(e).toMatchObject({ status: 'ended', endedOn: '2026-10-18', endNote: '別の形にする' });
  });
});

describe('週次チェック', () => {
  it('AC-HAB-14: 同じ週の週次チェックは上書きされる', async () => {
    const h = await saveHabit(draft(), NOW);
    await saveWeeklyCheck({ habitId: h.id, weekStart: '2026-10-12', automaticity: [2, 2, 2, 2], habitReview: null }, NOW);
    await saveWeeklyCheck(
      { habitId: h.id, weekStart: '2026-10-12', automaticity: [4, 3, 4, 5], habitReview: null },
      NOW + 1000,
    );
    await saveWeeklyCheck({ habitId: h.id, weekStart: '2026-10-05', automaticity: [1, 1, 1, 1], habitReview: null }, NOW);
    const checks = await db.weeklyChecks.where('habitId').equals(h.id).sortBy('weekStart');
    expect(checks).toHaveLength(2);
    expect(checks[1]).toMatchObject({ weekStart: '2026-10-12', automaticity: [4, 3, 4, 5], answeredAt: NOW + 1000 });
    expect((await db.habits.get(h.id))?.status).toBe('active');
  });

  it("AC-HAB-14: decision='end' で習慣が ended になる", async () => {
    const h = await saveHabit(draft(), NOW);
    await saveWeeklyCheck(
      {
        habitId: h.id,
        weekStart: '2026-10-12',
        automaticity: [3, 3, 3, 3],
        habitReview: { stillUseful: 2, wouldChooseAgain: false, decision: 'end' },
      },
      NOW,
    );
    expect(await db.habits.get(h.id)).toMatchObject({ status: 'ended', endedOn: '2026-10-18' });
  });

  it("decision='continue'／'reduce' では状態を変えない", async () => {
    const h = await saveHabit(draft(), NOW);
    for (const decision of ['continue', 'reduce'] as const) {
      await saveWeeklyCheck(
        {
          habitId: h.id,
          weekStart: '2026-10-12',
          automaticity: [3, 3, 3, 3],
          habitReview: { stillUseful: 4, wouldChooseAgain: true, decision },
        },
        NOW,
      );
      expect((await db.habits.get(h.id))?.status).toBe('active');
    }
  });
});

describe('対策と理由タグ', () => {
  it('saveCountermeasure は upsert', async () => {
    const h = await saveHabit(draft(), NOW);
    const cm = await saveCountermeasure(
      { habitId: h.id, conditionKey: 'weekday:5', conditionLabel: '金曜日', action: '前の晩に準備する' },
      NOW,
    );
    await saveCountermeasure({ ...cm, action: '朝にやる' }, NOW + DAY);
    const all = await db.countermeasures.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ action: '朝にやる', createdOn: '2026-10-18' });
  });

  it('saveReasonTag は追加・名前変更・非表示', async () => {
    const t = await saveReasonTag({ label: '雨' });
    expect(t).toMatchObject({ builtIn: false, archived: false, order: 7 });
    await saveReasonTag({ id: t.id, label: '天気' });
    await saveReasonTag({ id: t.id, label: '天気', archived: true });
    expect(await db.reasonTags.get(t.id)).toMatchObject({ label: '天気', archived: true, order: 7 });
    expect(await codeOfRejection(saveReasonTag({ label: 'あいうえおかきくけこさしす' }))).toBe('VALIDATION');
  });
});
