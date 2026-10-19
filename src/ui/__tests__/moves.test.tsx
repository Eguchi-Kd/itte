import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { testDb as db } from '../../db/__tests__/helpers';
import { createMove, saveEvaluationFunction } from '../../db/repo/board';
import { NOW, renderAt, resetDb } from './testUtils';

const next = () => screen.getByRole('button', { name: ja.common.next });
const cand = (description: string) => ({ description, plus1: null, plus2: null, score: null });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
});

afterEach(() => {
  vi.useRealTimers();
});

async function toStep2() {
  renderAt('/moves/new');
  fireEvent.change(await screen.findByLabelText(ja.board.situationQ), { target: { value: '誘いへの返事' } });
  fireEvent.click(next());
}

describe('読みシート', () => {
  it('AC-BOARD-07: 候補が1件では次へ進めず、4件目は追加できない', async () => {
    await toStep2();
    expect(screen.getAllByTestId(/^candidate-/)).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('候補 1'), { target: { value: '行く' } });
    expect(next()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: ja.board.addCandidate }));
    expect(screen.getAllByTestId(/^candidate-/)).toHaveLength(3);
    expect(screen.queryByRole('button', { name: ja.board.addCandidate })).toBeNull();
    fireEvent.change(screen.getByLabelText('候補 3'), { target: { value: '保留する' } });
    expect(next()).toBeEnabled();
  });

  it('AC-BOARD-08: 全ステップの上部に、有効な評価関数の指標が表示される', async () => {
    await saveEvaluationFunction({ metric: '週に書いた章数', avoid: [], startDate: '2026-10-01', endDate: '2026-12-31' }, NOW);
    renderAt('/moves/new');
    const bandText = '評価関数: 週に書いた章数';
    expect(await screen.findByTestId('lesson-band')).toHaveTextContent(bandText);
    fireEvent.change(screen.getByLabelText(ja.board.situationQ), { target: { value: '局面' } });
    fireEvent.click(next());
    expect(screen.getByTestId('lesson-band')).toHaveTextContent(bandText);
    fireEvent.change(screen.getByLabelText('候補 1'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('候補 2'), { target: { value: 'B' } });
    fireEvent.click(next());
    expect(screen.getByTestId('lesson-band')).toHaveTextContent(bandText);
    fireEvent.click(next());
    expect(await screen.findByRole('radiogroup', { name: ja.board.chooseQ })).toBeInTheDocument();
    expect(screen.getByTestId('lesson-band')).toHaveTextContent(bandText);
  });

  async function toStep3() {
    await toStep2();
    fireEvent.change(screen.getByLabelText('候補 1'), { target: { value: '行く' } });
    fireEvent.change(screen.getByLabelText('候補 2'), { target: { value: '断る' } });
    fireEvent.click(next());
  }

  it('AC-BOARD-09: 「先が読めない」をオンにすると初期定跡3つが表示される', async () => {
    await toStep3();
    expect(screen.queryByTestId('joseki-cards')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: ja.board.unreadable }));
    const cards = screen.getByTestId('joseki-cards');
    for (const j of ja.board.joseki) expect(cards).toHaveTextContent(j);
  });

  it('AC-BOARD-10: 「戻せない手がある」をオンにすると「保留できないか」の注意が表示される', async () => {
    await toStep3();
    expect(screen.queryByTestId('hold-warning')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: ja.board.irreversible }));
    expect(screen.getByTestId('hold-warning')).toHaveTextContent(ja.board.holdWarning);
  });

  it('AC-BOARD-11: 必須項目（局面、候補2件）だけで保存でき、「あとで決める」でホームの決めかけの手になる', async () => {
    await toStep3();
    fireEvent.click(next());
    await waitFor(async () => expect(await db.moves.count()).toBe(1));
    const move = (await db.moves.toArray())[0];
    expect(move).toMatchObject({ situation: '誘いへの返事', triggerId: null, mode: 'full', decidedAt: null, irreversible: false, unreadable: false });
    fireEvent.click(await screen.findByRole('button', { name: ja.board.decideLater }));
    expect(await screen.findByTestId(`decide-node-${move.id}`)).toHaveAttribute('data-state', 'next');
  });

  it('ステップ4で候補を選んで「これにする」で決定まで終える', async () => {
    await toStep3();
    fireEvent.click(next());
    fireEvent.click(await screen.findByRole('radio', { name: '断る' }));
    fireEvent.click(screen.getByRole('button', { name: ja.board.chooseThis }));
    await waitFor(async () => expect((await db.moves.toArray())[0].decidedAt).toBe(NOW));
    const move = (await db.moves.toArray())[0];
    const chosen = await db.candidates.get(move.chosenCandidateId ?? '');
    expect(chosen?.description).toBe('断る');
  });
});

describe('決めかけの手', () => {
  it('AC-BOARD-12: ホームの決めかけの手で候補を選んで確定すると decidedAt が記録され、ホームのまま完了になる', async () => {
    const { move, candidates } = await createMove(
      { situation: '誘いへの返事', triggerId: null, irreversible: false, unreadable: false, candidates: [cand('行く'), cand('断る')] },
      NOW - 1000,
    );
    const { router } = renderAt('/');
    const node = await screen.findByTestId(`decide-node-${move.id}`);
    const decide = within(node).getByRole('button', { name: ja.today.node.decide });
    expect(decide).toBeDisabled();
    fireEvent.click(within(node).getByRole('radio', { name: '行く' }));
    fireEvent.click(decide);
    await waitFor(async () => expect(await db.moves.get(move.id)).toMatchObject({ decidedAt: NOW, chosenCandidateId: candidates[0].id }));
    await waitFor(() => expect(screen.queryByTestId(`decide-node-${move.id}`)).toBeNull());
    expect(router.state.location.pathname).toBe('/');
  });

  it('手を決める画面で候補を選んで「これにする」と、ホームに戻る', async () => {
    const { move } = await createMove(
      { situation: '局面', triggerId: null, irreversible: false, unreadable: false, candidates: [{ description: 'A', plus1: '1手後', plus2: null, score: 1 }, cand('B')] },
      NOW,
    );
    const { router } = renderAt(`/moves/${move.id}`);
    const a = await screen.findByRole('radio', { name: /A/ });
    expect(a).toHaveTextContent('1手後');
    expect(a).toHaveTextContent('+1');
    fireEvent.click(a);
    fireEvent.click(screen.getByRole('button', { name: ja.board.chooseThis }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect((await db.moves.get(move.id))?.decidedAt).toBe(NOW);
  });
});

describe('簡易記録', () => {
  it('AC-BOARD-14: ?retro=1 で「あとから記録」が既定でオンになり、mode=quick・decidedAt つきで保存される', async () => {
    const { router } = renderAt('/moves/quick?retro=1');
    expect(await screen.findByTestId('retro-toggle')).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(screen.getByLabelText(ja.board.quickSituation), { target: { value: '衝動買い' } });
    fireEvent.change(screen.getByLabelText(ja.board.quickChosen), { target: { value: '買った' } });
    fireEvent.click(screen.getByRole('button', { name: ja.board.move.save }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await db.moves.toArray()).toMatchObject([{ mode: 'quick', retro: true, decidedAt: NOW, chosenText: '買った' }]);
  });

  it('?retro がなければ既定はオフ', async () => {
    renderAt('/moves/quick');
    expect(await screen.findByTestId('retro-toggle')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('定跡と手の記録', () => {
  it('定跡を足し、非表示にできる', async () => {
    renderAt('/library/joseki');
    const list = await screen.findByTestId('joseki-list');
    for (const j of ja.board.joseki) expect(list).toHaveTextContent(j);
    fireEvent.change(screen.getByLabelText(ja.board.josekiList.principle), { target: { value: '一晩おく' } });
    fireEvent.click(screen.getByRole('button', { name: ja.board.josekiList.add }));
    await waitFor(() => expect(screen.getByTestId('joseki-list')).toHaveTextContent('一晩おく'));
    const row = screen.getByText('一晩おく').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: ja.board.josekiList.hide }));
    await waitFor(() => expect(screen.getByTestId('joseki-list')).not.toHaveTextContent('一晩おく'));
  });

  it('手の記録は週ごとに、未決定・簡易記録・あとから記録のラベルを出す', async () => {
    await createMove({ situation: '読み', triggerId: null, irreversible: false, unreadable: false, candidates: [cand('A'), cand('B')] }, NOW);
    renderAt('/library/moves');
    const list = await screen.findByTestId('move-list');
    expect(list).toHaveTextContent('10/12(月)の週');
    expect(list).toHaveTextContent('未決定');
  });
});
