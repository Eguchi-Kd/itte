import { beforeEach, describe, expect, it } from 'vitest';
import { undecidedMoves, validateCandidates } from '../../domain/board/moves';
import { db } from '../db';
import { createMove, createQuickMove, decideMove, saveJoseki, saveMoveReview } from '../repo/board';
import { upsertWeeklyReviewRun } from '../repo/common';
import { codeOfRejection, NOW, resetSeeded } from './helpers';

const DAY = 86400000;
const cand = (description: string) => ({ description, plus1: null, plus2: null, score: null });

beforeEach(async () => {
  await resetSeeded({ onboarded: true });
});

describe('読みシートの保存', () => {
  it('AC-BOARD-11: 必須項目（局面、候補2件の description）だけで保存できる', async () => {
    const { move, candidates } = await createMove(
      { situation: '誘いに返事をする', triggerId: null, irreversible: false, unreadable: false, candidates: [cand('行く'), cand('断る'), cand('')] },
      NOW,
    );
    expect(move).toMatchObject({ mode: 'full', retro: false, decidedAt: null, chosenCandidateId: null, chosenText: null });
    expect(candidates.map((c) => [c.position, c.description, c.plus1, c.score])).toEqual([
      [1, '行く', null, null],
      [2, '断る', null, null],
    ]);
    expect(await db.candidates.where('moveId').equals(move.id).count()).toBe(2);
  });

  it('AC-BOARD-07: 候補が1件では保存できず、4件は保存できない', async () => {
    const base = { situation: '局面', triggerId: null, irreversible: false, unreadable: false };
    expect(await codeOfRejection(createMove({ ...base, candidates: [cand('A'), cand(' ')] }, NOW))).toBe('VALIDATION');
    expect(await codeOfRejection(createMove({ ...base, candidates: [cand('A'), cand('B'), cand('C'), cand('D')] }, NOW))).toBe(
      'VALIDATION',
    );
    expect(await codeOfRejection(createMove({ ...base, situation: ' ', candidates: [cand('A'), cand('B')] }, NOW))).toBe('VALIDATION');
    expect(await db.moves.count()).toBe(0);
    expect(validateCandidates([cand('A'), cand('B'), cand('C')])).toBe(true);
    expect(validateCandidates([cand('A'), cand('あ'.repeat(201))])).toBe(false);
  });
});

describe('手を決める', () => {
  it('AC-BOARD-12: 候補を選んで決めると chosenCandidateId と decidedAt が入る', async () => {
    const { move, candidates } = await createMove(
      { situation: '局面', triggerId: null, irreversible: false, unreadable: false, candidates: [cand('A'), cand('B')] },
      NOW,
    );
    const decided = await decideMove(move.id, candidates[1].id, NOW + 1000);
    expect(decided).toMatchObject({ chosenCandidateId: candidates[1].id, decidedAt: NOW + 1000 });
  });

  it('AC-BOARD-13: 別の手の候補 ID で決定すると VALIDATION', async () => {
    const base = { triggerId: null, irreversible: false, unreadable: false, candidates: [cand('A'), cand('B')] };
    const one = await createMove({ ...base, situation: '一つめ' }, NOW);
    const two = await createMove({ ...base, situation: '二つめ' }, NOW);
    expect(await codeOfRejection(decideMove(one.move.id, two.candidates[0].id, NOW))).toBe('VALIDATION');
    expect(await codeOfRejection(decideMove(one.move.id, 'nothing', NOW))).toBe('VALIDATION');
    expect((await db.moves.get(one.move.id))?.decidedAt).toBeNull();
  });
});

describe('簡易記録', () => {
  it('AC-BOARD-14: 簡易記録は mode=quick、decidedAt が入り、retro を指定できる', async () => {
    const m = await createQuickMove({ situation: '飲み会に誘われた', chosenText: '行った', retro: true }, NOW);
    expect(m).toMatchObject({ mode: 'quick', decidedAt: NOW, retro: true, chosenText: '行った', chosenCandidateId: null });
    const n = await createQuickMove({ situation: '買い物', chosenText: '買わなかった', retro: false }, NOW);
    expect(n.retro).toBe(false);
    expect(await db.candidates.count()).toBe(0);
    expect(await codeOfRejection(createQuickMove({ situation: '局面', chosenText: ' ', retro: false }, NOW))).toBe('VALIDATION');
  });
});

describe('決めかけの手', () => {
  it('undecidedMoves は未決定の読みシートの手で、作成から7日以内（today-6 以降）', async () => {
    const base = { triggerId: null, irreversible: false, unreadable: false, candidates: [cand('A'), cand('B')] };
    const recent = await createMove({ ...base, situation: '6日前' }, NOW - 6 * DAY);
    await createMove({ ...base, situation: '7日前' }, NOW - 7 * DAY);
    const decided = await createMove({ ...base, situation: '決めた' }, NOW);
    await decideMove(decided.move.id, decided.candidates[0].id, NOW);
    await createQuickMove({ situation: '簡易', chosenText: 'x', retro: false }, NOW);
    const list = undecidedMoves(await db.moves.toArray(), '2026-10-18');
    expect(list.map((m) => m.id)).toEqual([recent.move.id]);
  });
});

describe('定跡', () => {
  it('追加・編集・非表示', async () => {
    const j = await saveJoseki({ principle: '迷ったら寝る' }, NOW);
    expect(j).toMatchObject({ origin: 'initial', archived: false, order: 3 });
    await saveJoseki({ id: j.id, principle: '迷ったら一晩おく' }, NOW);
    await saveJoseki({ id: j.id, principle: '迷ったら一晩おく', archived: true }, NOW);
    expect(await db.joseki.get(j.id)).toMatchObject({ principle: '迷ったら一晩おく', archived: true });
  });
});

describe('感想戦', () => {
  async function aMove() {
    return (
      await createMove(
        { situation: '誘い', triggerId: null, irreversible: false, unreadable: false, candidates: [cand('行く'), cand('断る')] },
        NOW,
      )
    ).move;
  }

  it('AC-BOARD-15: rating=bad のとき見落としを選ばないと保存できない。判断の妥当さと結果は別々に保存される', async () => {
    const m = await aMove();
    const base = { moveId: m.id, outcome: '疲れた', judgmentOk: true, note: null };
    expect(await codeOfRejection(saveMoveReview({ ...base, rating: 'bad', blindSpot: null }, NOW))).toBe('VALIDATION');
    expect(await db.moveReviews.count()).toBe(0);
    const r = await saveMoveReview({ ...base, rating: 'bad', blindSpot: 'reading' }, NOW);
    expect(r).toMatchObject({ judgmentOk: true, outcome: '疲れた', rating: 'bad', blindSpot: 'reading' });
  });

  it('AC-BOARD-16: 同じ手の感想戦を2回保存すると上書きされる', async () => {
    const m = await aMove();
    const first = await saveMoveReview({ moveId: m.id, outcome: null, judgmentOk: false, rating: 'neutral', blindSpot: null, note: null }, NOW);
    const second = await saveMoveReview({ moveId: m.id, outcome: '結果', judgmentOk: true, rating: 'good', blindSpot: null, note: 'メモ' }, NOW + 1000);
    expect(await db.moveReviews.count()).toBe(1);
    expect(second.id).toBe(first.id);
    expect(await db.moveReviews.get(first.id)).toMatchObject({ rating: 'good', judgmentOk: true, outcome: '結果', reviewedAt: NOW + 1000 });
  });

  it('AC-BOARD-17: 「定跡にする」で、moveReviewId 付きの Joseki が作られる', async () => {
    const m = await aMove();
    const r = await saveMoveReview(
      { moveId: m.id, outcome: null, judgmentOk: true, rating: 'bad', blindSpot: 'trigger', note: null, promoteToJoseki: '誘いは一晩おいて返す' },
      NOW,
    );
    const j = (await db.joseki.toArray()).find((x) => x.principle === '誘いは一晩おいて返す');
    expect(j).toMatchObject({ origin: 'review', moveReviewId: r.id, archived: false });
  });
});

describe('週次ふりかえりの進み具合', () => {
  it('開始・カーソル更新・完了を週ごとに1件で持つ', async () => {
    const a = await upsertWeeklyReviewRun('2026-10-12', { cursor: 0 }, NOW);
    await upsertWeeklyReviewRun('2026-10-12', { cursor: 3 }, NOW + 1000);
    const done = await upsertWeeklyReviewRun('2026-10-12', { completed: true, cursor: 5 }, NOW + 2000);
    expect(await db.weeklyReviewRuns.count()).toBe(1);
    expect(done).toMatchObject({ id: a.id, startedAt: NOW, completedAt: NOW + 2000, cursor: 5 });
  });
});
