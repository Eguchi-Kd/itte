import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { habitDraft, testDb as db } from '../../db/__tests__/helpers';
import { saveBoardItem, saveEvaluationFunction, saveTrigger } from '../../db/repo/board';
import { saveHabit } from '../../db/repo/habits';
import { NOW, renderAt, resetDb } from './testUtils';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
  await saveHabit(habitDraft(), NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ホームの盤面の帯とバナー', () => {
  it('AC-BOARD-03: 今日を含む評価関数がなく、盤面モジュールを使ったことがあるとき、ホームに評価関数を決めるバナーが出る', async () => {
    await saveBoardItem({ type: 'deadline', title: 'ゼミ発表', dueDate: '2026-10-20' }, NOW);
    await saveEvaluationFunction({ metric: '去年の指標', avoid: [], startDate: '2026-07-01', endDate: '2026-10-17' }, NOW);
    renderAt('/');
    const banner = await screen.findByTestId('eval-banner');
    expect(within(banner).getByRole('link', { name: ja.today.setEval })).toHaveAttribute('href', '/settings/evaluation');
    expect(screen.queryByTestId('board-strip')).toBeNull();
  });

  it('AC-BOARD-03: 盤面モジュールを使ったことがなければバナーも帯も出さない', async () => {
    renderAt('/');
    await screen.findByTestId('today-path');
    expect(screen.queryByTestId('eval-banner')).toBeNull();
    expect(screen.queryByTestId('board-strip')).toBeNull();
  });

  it('有効な評価関数があれば、帯に指標と直近の期限のチップを最大3つ出す', async () => {
    await saveEvaluationFunction({ metric: '週に書いた章数', avoid: [], startDate: '2026-10-01', endDate: '2026-12-31' }, NOW);
    for (const [title, due] of [['A', '2026-10-21'], ['B', '2026-10-18'], ['C', '2026-10-25'], ['D', '2026-10-30']]) {
      await saveBoardItem({ type: 'deadline', title, dueDate: due }, NOW);
    }
    renderAt('/');
    const strip = await screen.findByTestId('board-strip');
    expect(strip).toHaveTextContent('評価関数: 週に書いた章数');
    expect(strip).toHaveTextContent('B 今日');
    expect(strip).toHaveTextContent('A あと3日');
    expect(strip).toHaveTextContent('C あと7日');
    expect(strip).not.toHaveTextContent('D あと');
    expect(screen.queryByTestId('eval-banner')).toBeNull();
  });
});

describe('評価関数の設定', () => {
  it('AC-BOARD-05: 「避けたいこと」は4件目を入力できない（4つ目の入力欄を出さない）', async () => {
    renderAt('/settings/evaluation');
    const form = await screen.findByTestId('eval-form');
    for (let i = 1; i <= 3; i++) {
      fireEvent.change(within(form).getByLabelText(`避けたいこと ${i}`), { target: { value: `避けたいこと${i}` } });
    }
    expect(within(form).queryByLabelText('避けたいこと 4')).toBeNull();
    expect(within(form).getAllByLabelText(/^避けたいこと \d$/)).toHaveLength(3);
    fireEvent.change(within(form).getByLabelText(ja.board.evalForm.metric), { target: { value: '週に書いた章数' } });
    fireEvent.click(within(form).getByRole('button', { name: ja.board.evalForm.save }));
    await waitFor(async () => expect(await db.evaluationFunctions.count()).toBe(1));
    expect((await db.evaluationFunctions.toArray())[0]).toMatchObject({
      metric: '週に書いた章数',
      avoid: ['避けたいこと1', '避けたいこと2', '避けたいこと3'],
      startDate: '2026-10-18',
      endDate: '2027-01-18',
    });
  });

  it('AC-BOARD-04: 期間が重なる評価関数を保存すると、日本語のエラー文が表示される', async () => {
    await saveEvaluationFunction({ metric: '既存', avoid: [], startDate: '2026-12-01', endDate: '2027-02-01' }, NOW);
    renderAt('/settings/evaluation');
    const form = await screen.findByTestId('eval-form');
    fireEvent.change(within(form).getByLabelText(ja.board.evalForm.metric), { target: { value: '新しい指標' } });
    fireEvent.click(within(form).getByRole('button', { name: ja.board.evalForm.save }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('期間が、すでにある評価関数と重なっています');
    expect(await db.evaluationFunctions.count()).toBe(1);
  });
});

describe('手番トリガーの設定', () => {
  it('例のチップで条件を入れて追加でき、6件目の有効化は「有効にできるのは5つまでです」', async () => {
    for (let i = 0; i < 5; i++) await saveTrigger({ conditionText: `条件${i}`, active: true }, NOW + i);
    await saveTrigger({ conditionText: '止めてある条件', active: false }, NOW + 9);
    renderAt('/settings/triggers');
    const sw = await screen.findByRole('switch', { name: `止めてある条件 ${ja.board.triggers.active}` });
    fireEvent.click(sw);
    expect(await screen.findByRole('alert')).toHaveTextContent('有効にできるのは5つまでです');
    expect(sw).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByRole('radio', { name: '誘いへの返事' }));
    fireEvent.click(screen.getByRole('button', { name: ja.board.triggers.add }));
    await waitFor(async () => expect(await db.turnTriggers.count()).toBe(7));
    expect((await db.turnTriggers.toArray()).find((t) => t.conditionText === '誘いへの返事')?.active).toBe(false);
  });
});

describe('盤面タブ', () => {
  it('期限リストを期限の近い順に並べ、メニューから「10分だけ手をつける」でラフ登録へ移る', async () => {
    const a = await saveBoardItem({ type: 'deadline', title: '提出', dueDate: '2026-10-25' }, NOW);
    await saveBoardItem({ type: 'event', title: 'ゼミ', dueDate: '2026-10-19' }, NOW);
    await saveBoardItem({ type: 'project', title: '卒論', dueDate: null }, NOW);
    const { router } = renderAt('/board');
    const list = await screen.findByTestId('deadline-list');
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('ゼミあと1日'),
      expect.stringContaining('提出あと7日'),
    ]);
    expect(screen.getByTestId('project-list')).toHaveTextContent('卒論');
    fireEvent.click(screen.getByRole('button', { name: '提出のメニュー' }));
    fireEvent.click(screen.getByRole('button', { name: ja.board.touch }));
    await waitFor(() => expect(router.state.location.search).toBe(`?boardItemId=${a.id}`));
    expect(await screen.findByLabelText(ja.start.field.title)).toHaveValue('提出');
  });

  it('削除は取り消しスナックバーで戻せる', async () => {
    const a = await saveBoardItem({ type: 'deadline', title: '提出', dueDate: '2026-10-25' }, NOW);
    renderAt('/board');
    fireEvent.click(await screen.findByRole('button', { name: '提出のメニュー' }));
    fireEvent.click(screen.getByRole('button', { name: ja.board.delete }));
    await waitFor(async () => expect(await db.boardItems.count()).toBe(0));
    fireEvent.click(within(screen.getByTestId('snackbar')).getByRole('button', { name: ja.common.undo }));
    await waitFor(async () => expect(await db.boardItems.get(a.id)).toMatchObject({ title: '提出' }));
  });

  it('「追加」から締切を足すと盤面に戻る', async () => {
    const { router } = renderAt('/board/items/new');
    fireEvent.change(await screen.findByLabelText(ja.board.item.text), { target: { value: '面談の返事' } });
    fireEvent.click(screen.getByRole('button', { name: ja.board.item.save }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/board'));
    expect(await db.boardItems.toArray()).toMatchObject([{ type: 'deadline', title: '面談の返事', dueDate: null }]);
  });
});
