import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { taskInput, testDb as db } from '../../db/__tests__/helpers';
import { createTask, interruptSession, startSession } from '../../db/repo/start';
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

async function ended(roughMode = true) {
  const t = await createTask(taskInput({ title: '卒論の序章' }), true, NOW - 11 * MIN);
  const s = await startSession(t.id, roughMode, null, NOW - 11 * MIN);
  return { t, s };
}

describe('セッション終了', () => {
  it('事実の要約「{n}分 取り組みました」と、同じ大きさの「続ける」「やめる」を出す', async () => {
    const { s } = await ended();
    renderAt(`/session/${s.id}/end`);
    expect(await screen.findByRole('heading', { name: '10分 取り組みました' })).toBeInTheDocument();
    const keep = screen.getByRole('button', { name: ja.start.continue });
    const stop = screen.getByRole('button', { name: ja.start.stop });
    expect(keep.className.replace(' border-primary', '')).toBe(stop.className.replace(' border-primary', ''));
  });

  it('AC-START-04: B 条件で「やめる」を選び、次の一手が空なら確定できない。確定後、ホームのやることノードに次の一手が表示される', async () => {
    const { t, s } = await ended(true);
    const { router } = renderAt(`/session/${s.id}/end`);
    fireEvent.click(await screen.findByRole('button', { name: ja.start.stop }));
    const confirm = screen.getByRole('button', { name: ja.common.confirm });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(ja.start.nextQ), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(ja.start.nextQ), { target: { value: '見出しを3つ足す' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await db.sessions.get(s.id)).toMatchObject({ outcome: 'stopped' });
    expect((await db.tasks.get(t.id))?.nextStep).toBe('見出しを3つ足す');
    const node = await screen.findByTestId(`task-node-${t.id}`);
    expect(node).toHaveTextContent('見出しを3つ足す');
  });

  it('A 条件で始めたセッションでは次の一手を聞かずに「やめる」でホームへ', async () => {
    const { t, s } = await ended(false);
    const { router } = renderAt(`/session/${s.id}/end`);
    fireEvent.click(await screen.findByRole('button', { name: ja.start.stop }));
    expect(screen.queryByLabelText(ja.start.nextQ)).toBeNull();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect((await db.tasks.get(t.id))?.nextStep).toBeNull();
  });

  it('AC-START-05: 「続ける」で前のセッションが continued になり、同じやることの新しいセッションのタイマーへ移る', async () => {
    const { t, s } = await ended();
    const { router } = renderAt(`/session/${s.id}/end`);
    fireEvent.click(await screen.findByRole('button', { name: ja.start.continue }));
    await waitFor(async () => expect(await db.sessions.count()).toBe(2));
    expect(await db.sessions.get(s.id)).toMatchObject({ outcome: 'continued', endedAt: NOW });
    const next = (await db.sessions.toArray()).find((x) => x.id !== s.id);
    expect(next).toMatchObject({ taskId: t.id, startedAt: NOW, endedAt: null });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/session/${next?.id}`));
    expect(within(await screen.findByTestId('session-timer')).getByTestId('timer-text')).toHaveTextContent('10:00');
  });

  it('中断で閉じたあとの終了画面でも「続ける」で新しいセッションを始められ、「やめる」は次の一手だけを更新する', async () => {
    const { t, s } = await ended();
    await interruptSession(s.id, NOW - 8 * MIN);
    const { unmount } = renderAt(`/session/${s.id}/end`);
    expect(await screen.findByRole('heading', { name: '3分 取り組みました' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ja.start.stop }));
    fireEvent.change(screen.getByLabelText(ja.start.nextQ), { target: { value: '資料を探す' } });
    fireEvent.click(screen.getByRole('button', { name: ja.common.confirm }));
    await waitFor(async () => expect((await db.tasks.get(t.id))?.nextStep).toBe('資料を探す'));
    expect(await db.sessions.get(s.id)).toMatchObject({ outcome: 'stopped', endedAt: NOW - 8 * MIN });
    unmount();

    renderAt(`/session/${s.id}/end`);
    fireEvent.click(await screen.findByRole('button', { name: ja.start.continue }));
    await waitFor(async () => expect(await db.sessions.count()).toBe(2));
  });
});
