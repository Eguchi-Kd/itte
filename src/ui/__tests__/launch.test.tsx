import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { taskInput, testDb as db } from '../../db/__tests__/helpers';
import { onLaunch } from '../../db/init';
import { createTask, startSession } from '../../db/repo/start';
import { upsertWeeklyReviewRun } from '../../db/repo/common';
import type { ID } from '../../domain/types';
import { routes } from '../../routes';
import { LaunchContext } from '../hooks/launchContext';
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

/** App.tsx と同じく、起動時の処理の結果を LaunchContext で渡す */
function LaunchHarness({ initial, path }: { initial: ID | null; path: string }) {
  const [id, setId] = useState(initial);
  const [router] = useState(() => createMemoryRouter(routes, { initialEntries: [path] }));
  return (
    <LaunchContext.Provider value={{ escapeSessionId: id, clearEscape: () => setId(null) }}>
      <RouterProvider router={router} />
    </LaunchContext.Provider>
  );
}

describe('起動時の処理', () => {
  it('AC-START-08: 40分以上前に開始された未終了のセッションが abandoned（endedAt = startedAt + 10分）になり、逃避ログのシートが1回だけ表示される', async () => {
    const t = await createTask(taskInput(), true, NOW - 50 * MIN);
    const old = await startSession(t.id, true, null, NOW - 50 * MIN);
    await db.sessions.add({ ...old, id: 'older', startedAt: NOW - 90 * MIN });

    const first = await onLaunch(NOW);
    expect(first.abandoned).toEqual(['older', old.id]);
    expect(await db.sessions.get(old.id)).toMatchObject({ outcome: 'abandoned', endedAt: NOW - 40 * MIN });

    render(<LaunchHarness initial={first.abandoned.at(-1) ?? null} path="/" />);
    const sheet = await screen.findByTestId('escape-sheet');
    expect(sheet).toHaveAccessibleName(ja.start.escapeIntro);
    fireEvent.click(within(sheet).getByRole('radio', { name: ja.start.fatigue }));
    fireEvent.click(within(sheet).getByRole('button', { name: ja.start.escape.record }));
    await waitFor(() => expect(screen.queryByTestId('escape-sheet')).toBeNull());
    expect(await db.escapeLogs.toArray()).toMatchObject([{ sessionId: old.id, priorState: 'fatigue', target: null }]);

    // もう一度起動しても、閉じたセッションはもう放置として数えない
    expect((await onLaunch(NOW + MIN)).abandoned).toEqual([]);
  });

  it('逃避ログのシートはレッスンの画面では出さず、タブの画面に戻ったときに出す', async () => {
    render(<LaunchHarness initial="s-x" path="/habits/new" />);
    await screen.findByTestId('lesson-shell');
    expect(screen.queryByTestId('escape-sheet')).toBeNull();
  });
});

describe('逃避ログ', () => {
  it('AC-START-09: 全項目が空でも「記録する」で保存できる。「とばす」は保存せずにホームへ', async () => {
    const { router } = renderAt('/escape/new');
    fireEvent.click(await screen.findByRole('button', { name: ja.start.escape.record }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await db.escapeLogs.toArray()).toMatchObject([{ priorState: null, target: null, enjoyed: null, taskId: null }]);

    const again = renderAt('/escape/new');
    fireEvent.click(await screen.findAllByRole('button', { name: ja.common.skip }).then((b) => b[0]));
    await waitFor(() => expect(again.router.state.location.pathname).toBe('/'));
    expect(await db.escapeLogs.count()).toBe(1);
  });
});

describe('1日のしめ', () => {
  async function answer(worry: string, minutes: string, planned: string) {
    fireEvent.click(await screen.findByRole('radio', { name: worry }));
    fireEvent.click(await screen.findByRole('radio', { name: minutes }));
    fireEvent.click(await screen.findByRole('radio', { name: planned }));
  }

  it('AC-START-10: 3問に答えると保存され、同じ論理日の2回目は上書きされる', async () => {
    const a = renderAt('/daily');
    await answer(ja.start.yes, '120', ja.start.no);
    await waitFor(() => expect(a.router.state.location.pathname).toBe('/'));
    a.unmount();
    expect(await db.dailyChecks.toArray()).toMatchObject([
      { date: '2026-10-18', pendingWorry: true, consumptionMin: 120, plannedTaskExists: false },
    ]);

    const b = renderAt('/daily');
    await answer(ja.start.no, '30', ja.start.yes);
    await waitFor(() => expect(b.router.state.location.pathname).toBe('/'));
    expect(await db.dailyChecks.toArray()).toMatchObject([
      { date: '2026-10-18', pendingWorry: false, consumptionMin: 30, plannedTaskExists: true },
    ]);
  });

  it('時間は 0〜1440 に収まり、空のあいだは進めない', async () => {
    renderAt('/daily');
    fireEvent.click(await screen.findByRole('radio', { name: ja.start.no }));
    const next = await screen.findByRole('button', { name: ja.common.next });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: ja.start.consumeQ }), { target: { value: '5000' } });
    expect(screen.getByRole('textbox', { name: ja.start.consumeQ })).toHaveValue('1440');
    expect(next).toBeEnabled();
  });

  it('着手モジュールを使ったことがあるとき、ホームの道の最後に「1日のしめ」を出し、答えると記録済みになる', async () => {
    await upsertWeeklyReviewRun('2026-10-12', { completed: true }, NOW);
    await createTask(taskInput({ plannedFor: '2026-10-17' }), true, NOW - 1440 * MIN);
    const { router } = renderAt('/');
    const node = await screen.findByTestId('daily-node');
    expect(node).toHaveAttribute('data-state', 'next');
    fireEvent.click(within(node).getByRole('button', { name: ja.today.node.answer }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/daily'));
    await answer(ja.start.no, '0', ja.start.no);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await waitFor(() => expect(screen.getByTestId('daily-node')).toHaveAttribute('data-state', 'done'));
  });
});
