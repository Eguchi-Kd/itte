import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { codeOfRejection, testDb as db } from '../../db/__tests__/helpers';
import { startExperiment, stopExperiment } from '../../db/repo/common';
import { createGoal, detectDueGoals, saveMetric } from '../../db/repo/goals';
import { dayStart } from '../../domain/dates';
import { NOW, renderAt, resetDb } from './testUtils';

const TODAY = '2026-10-18';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('実験の開始と中止', () => {
  it('AC-EXP-03: 実験の実行中に2つ目を始めると CONFLICT', async () => {
    const e = await startExperiment('start', TODAY, NOW);
    expect(await codeOfRejection(startExperiment('board', TODAY, NOW))).toBe('CONFLICT');
    // 開始日前の予約も実行中として数える
    await stopExperiment(e.id, NOW);
    await startExperiment('board', '2026-10-26', NOW);
    expect(await codeOfRejection(startExperiment('kizami', TODAY, NOW))).toBe('CONFLICT');
    expect(await db.experiments.count()).toBe(2);
  });
});

describe('着手プリセットの A 条件', () => {
  it('AC-EXP-04: ラフ登録が1ステップになり、タイマーに詰まりボタンがなく、Session.roughMode=false で記録される', async () => {
    await startExperiment('start', TODAY, NOW); // 今日が w0（A）
    const { router } = renderAt('/tasks/new?start=1');
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuemax', '1');
    fireEvent.change(screen.getByLabelText(ja.start.field.title), { target: { value: '序章' } });
    fireEvent.click(screen.getByRole('button', { name: ja.start.saveStart }));
    await waitFor(async () => expect(await db.sessions.count()).toBe(1));
    expect((await db.tasks.toArray())[0]).toMatchObject({ title: '序章', roughVersion: null, firstAction: null });
    expect((await db.sessions.toArray())[0].roughMode).toBe(false);
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/session\//));
    await screen.findByTestId('session-timer');
    expect(screen.queryByRole('button', { name: ja.start.stuck })).toBeNull();
    expect(screen.getByRole('button', { name: ja.start.interrupt })).toBeInTheDocument();
    expect(screen.getByTestId('timer-focus')).toHaveTextContent('序章');
  });
});

describe('盤面プリセットの A 条件', () => {
  it('AC-EXP-05: ＋ の「手番」が簡易記録に遷移し、Move.phase=A で記録される', async () => {
    await startExperiment('board', TODAY, NOW);
    const { router } = renderAt('/');
    fireEvent.click(await screen.findByTestId('nav-add'));
    fireEvent.click(within(screen.getByTestId('quick-sheet')).getByTestId('quick-turn'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/moves/quick'));
    fireEvent.change(await screen.findByLabelText(ja.board.quickSituation), { target: { value: '誘い' } });
    fireEvent.change(screen.getByLabelText(ja.board.quickChosen), { target: { value: '行った' } });
    fireEvent.click(screen.getByRole('button', { name: ja.board.move.save }));
    await waitFor(async () => expect(await db.moves.toArray()).toMatchObject([{ mode: 'quick', phase: 'A' }]));
  });

  it('実験がなければ「手番」は読みシートへ移り、phase は null', async () => {
    const { router } = renderAt('/');
    fireEvent.click(await screen.findByTestId('nav-add'));
    fireEvent.click(within(screen.getByTestId('quick-sheet')).getByTestId('quick-turn'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/moves/new'));
  });
});

describe('段プリセットの A 条件', () => {
  it('AC-EXP-06: 判定ノードがホームに出ず、判定すると enforced=false で記録される', async () => {
    const m = await saveMetric({ name: '章数', unit: '章', direction: 'HIGHER_IS_BETTER', collectionMethod: '数える', verifiable: true }, NOW);
    const g = await createGoal(
      { metricId: m.id, title: '期限切れの段', targetValue: 3, comparator: 'GTE', deadline: '2026-10-15', onMet: 'a', onUnmet: 'b', probability: 50, predictedValue: 3 },
      dayStart('2026-10-05'),
    );
    await detectDueGoals(TODAY, NOW);
    await startExperiment('kizami', TODAY, NOW);
    renderAt('/');
    await screen.findByTestId('home');
    expect(screen.queryByTestId(`judge-node-${g.id}`)).toBeNull();

    renderAt(`/judge/${g.id}`);
    fireEvent.change(await screen.findByTestId('judge-actual'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: ja.common.check }));
    fireEvent.click(within(screen.getByTestId('check-sheet')).getByRole('button', { name: ja.common.confirm }));
    await waitFor(async () => expect(await db.judgments.toArray()).toMatchObject([{ goalId: g.id, enforced: false, outcome: 'MET' }]));
  });
});

describe('実験の画面', () => {
  it('実行中でなければプリセット3つを出し、始めると週の帯と今の条件と仮説の表を出す。中止できる', async () => {
    renderAt('/review/experiment');
    expect(await screen.findByTestId('preset-start')).toHaveTextContent('4週');
    expect(screen.getByTestId('preset-board')).toHaveTextContent('10週');
    expect(screen.getByTestId('preset-kizami')).toHaveTextContent('12週');
    expect(screen.getByTestId('experiment-start-date')).toHaveValue('2026-10-19');
    fireEvent.change(screen.getByTestId('experiment-start-date'), { target: { value: TODAY } });
    fireEvent.click(within(screen.getByTestId('preset-start')).getByRole('button', { name: ja.experiment.begin }));
    const running = await screen.findByTestId('experiment-running');
    expect(within(running).getByTestId('experiment-now')).toHaveTextContent(ja.experiment.presets.start.nowA);
    expect(within(running).getAllByRole('listitem').filter((li) => li.getAttribute('aria-current') === 'step')).toHaveLength(1);
    expect(running).toHaveTextContent('H1 完璧主義の予測 実験中');
    fireEvent.click(within(running).getByRole('button', { name: ja.experiment.stop }));
    fireEvent.click(within(screen.getByTestId('check-sheet')).getByRole('button', { name: ja.experiment.stop }));
    await waitFor(async () => expect((await db.experiments.toArray())[0].stoppedAt).toBe(NOW));
    expect(await screen.findByTestId('preset-start')).toBeInTheDocument();
    expect(screen.getByText(ja.experiment.limits)).toBeInTheDocument();
  });
});
