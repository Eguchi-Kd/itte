import { beforeEach, describe, expect, it } from 'vitest';
import { undecidedMoves, validateCandidates } from '../../domain/board/moves';
import { db } from '../db';
import { createMove, createQuickMove, decideMove, saveJoseki } from '../repo/board';
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
