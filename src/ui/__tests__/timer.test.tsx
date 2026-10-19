import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { taskInput, testDb as db } from '../../db/__tests__/helpers';
import { createTask, startSession } from '../../db/repo/start';
import { NOW, renderAt, resetDb } from './testUtils';

const MIN = 60_000;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
});

afterEach(() => {
  vi.useRealTimers();
});

async function running(startedAgoMs = 0) {
  const t = await createTask(taskInput({ title: '序章', firstAction: 'エディタを開く' }), true, NOW - startedAgoMs);
  const s = await startSession(t.id, true, null, NOW - startedAgoMs);
  return { t, s };
}

describe('10分タイマー', () => {
  it('残り時間を startedAt から計算し、最初の動作を大きく出し、タブのタイトルを「6:12 一手」にする', async () => {
    const { s } = await running(3 * MIN + 48_000);
    renderAt(`/session/${s.id}`);
    expect(await screen.findByTestId('timer-text')).toHaveTextContent('6:12');
    expect(screen.getByRole('timer')).toHaveAccessibleName('残り 6:12');
    expect(screen.getByTestId('timer-focus')).toHaveTextContent('エディタを開く');
    await waitFor(() => expect(document.title).toBe('6:12 一手'));
    expect(screen.queryByTestId('bottom-nav')).toBeNull();
    expect(screen.queryByTestId('koma')).toBeNull();
  });

  it('AC-START-06: 詰まりシートで fill／research5 を選んでもタイマーは止まらず、StuckLog が1件増える', async () => {
    const { s } = await running(MIN);
    const { router } = renderAt(`/session/${s.id}`);
    for (const label of [ja.start.fill, ja.start.research5]) {
      fireEvent.click(await screen.findByRole('button', { name: ja.start.stuck }));
      const sheet = screen.getByTestId('stuck-sheet');
      expect(within(sheet).getByRole('button', { name: label })).toBeDisabled();
      fireEvent.change(within(sheet).getByLabelText(ja.start.timer.blocker), { target: { value: '構成が決まらない' } });
      fireEvent.click(within(sheet).getByRole('button', { name: label }));
      await waitFor(() => expect(screen.queryByTestId('stuck-sheet')).toBeNull());
    }
    expect(await db.stuckLogs.count()).toBe(2);
    expect(await db.sessions.get(s.id)).toMatchObject({ endedAt: null, outcome: null });
    expect(router.state.location.pathname).toBe(`/session/${s.id}`);
    expect(screen.getByTestId('timer-text')).toHaveTextContent('9:00');
    expect(screen.getByRole('status')).toHaveTextContent(ja.feedback.stuckContinue);
  });

  it('AC-START-07: 詰まりシートで stop を選ぶとセッションが stopped になり、終了画面へ遷移する', async () => {
    const { s } = await running(2 * MIN);
    const { router } = renderAt(`/session/${s.id}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.start.stuck }));
    fireEvent.change(screen.getByLabelText(ja.start.timer.blocker), { target: { value: '資料がない' } });
    fireEvent.click(screen.getByRole('button', { name: ja.start.stopWithNext }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/session/${s.id}/end`));
    expect(await db.sessions.get(s.id)).toMatchObject({ outcome: 'stopped', endedAt: NOW });
    expect(await db.stuckLogs.count()).toBe(1);
    expect(screen.getByRole('status')).toHaveTextContent(ja.feedback.recorded);
  });

  it('「中断」で stopped にして終了画面へ', async () => {
    const { s } = await running(MIN);
    const { router } = renderAt(`/session/${s.id}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.start.interrupt }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/session/${s.id}/end`));
    expect(await db.sessions.get(s.id)).toMatchObject({ outcome: 'stopped' });
  });

  it('0:00 を過ぎていれば（バックグラウンドで過ぎた場合も）開いた時点で終了画面へ移る', async () => {
    const { s } = await running(10 * MIN + 5000);
    const { router } = renderAt(`/session/${s.id}`);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/session/${s.id}/end`));
    expect(await db.sessions.get(s.id)).toMatchObject({ endedAt: null });
  });
});
