import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { taskInput, testDb as db } from '../../db/__tests__/helpers';
import { createTask, startSession } from '../../db/repo/start';
import { NOW, renderAt, resetDb } from './testUtils';

const MIN = 60_000;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW); // 2026-10-18（日）12:00
  await resetDb({ onboarded: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('ホームのやること', () => {
  it('AC-START-02: ホームの今日のやることは最大1件で createdAt が最も古いもの。残りは「他のやること」に折りたたまれる', async () => {
    const b = await createTask(taskInput({ title: 'B' }), true, NOW - 2 * MIN);
    const a = await createTask(taskInput({ title: 'A' }), true, NOW - 3 * MIN);
    const c = await createTask(taskInput({ title: 'C' }), true, NOW - MIN);
    renderAt('/');
    const path = await screen.findByTestId('today-path');
    expect(within(path).getAllByTestId(/^task-node-/)).toHaveLength(1);
    expect(within(path).getByTestId(`task-node-${a.id}`)).toHaveAttribute('data-state', 'next');
    const others = screen.getByTestId('other-tasks');
    expect(others).not.toHaveAttribute('open');
    expect(others).toHaveTextContent('他のやること 2件');
    expect(within(others).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([`/tasks/${b.id}`, `/tasks/${c.id}`]);
  });

  it('次の一手があればノードに次の一手を出し、「始める」でセッションを作ってタイマーへ移る', async () => {
    const t = await createTask(taskInput({ title: '序章' }), true, NOW);
    await db.tasks.update(t.id, { nextStep: '見出しを3つ書く' });
    const { router } = renderAt('/');
    const node = await screen.findByTestId(`task-node-${t.id}`);
    expect(node).toHaveTextContent('見出しを3つ書く');
    fireEvent.click(within(node).getByRole('button', { name: '見出しを3つ書くを始める' }));
    await waitFor(async () => expect(await db.sessions.count()).toBe(1));
    const s = (await db.sessions.toArray())[0];
    expect(s).toMatchObject({ taskId: t.id, roughMode: true, endedAt: null });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/session/${s.id}`));
  });

  it('持ち越しカード: 「今日に移す」で予定日が今日になり、「片づける」→「やめた」で片づく', async () => {
    const t1 = await createTask(taskInput({ title: '古い1', plannedFor: '2026-10-16' }), true, NOW - 3 * MIN);
    const t2 = await createTask(taskInput({ title: '古い2', plannedFor: '2026-10-17' }), true, NOW - 2 * MIN);
    renderAt('/');
    const card = await screen.findByTestId('carry-card');
    expect(card).toHaveTextContent('昨日までのやること 2件');
    expect(within(card).getByTestId('carry-title')).toHaveTextContent('古い1');
    fireEvent.click(within(card).getByRole('button', { name: ja.today.interrupt.carryMove }));
    await waitFor(async () => expect(await db.tasks.get(t1.id)).toMatchObject({ plannedFor: '2026-10-18', planHistory: ['2026-10-16'] }));
    await waitFor(() => expect(screen.getByTestId('carry-title')).toHaveTextContent('古い2'));
    fireEvent.click(within(screen.getByTestId('carry-card')).getByRole('button', { name: ja.today.interrupt.carryClose }));
    fireEvent.click(screen.getByRole('radio', { name: ja.start.closeDrop }));
    await waitFor(async () => expect(await db.tasks.get(t2.id)).toMatchObject({ closedReason: 'dropped' }));
    await waitFor(() => expect(screen.queryByTestId('carry-card')).toBeNull());
  });

  it('進行中のセッションがあれば再開カードに残り時間を出す', async () => {
    const t = await createTask(taskInput(), true, NOW);
    await startSession(t.id, true, null, NOW - 3 * MIN - 48_000);
    renderAt('/');
    expect(await screen.findByTestId('resume-text')).toHaveTextContent('10分タイマーの途中です 残り 6:12');
  });
});

describe('ラフ登録', () => {
  it('3ステップで、各ステップの入力が空なら進めず、「保存」でホームに戻る', async () => {
    const { router } = renderAt('/tasks/new');
    const next = async () => screen.findByRole('button', { name: ja.common.next });
    expect(await next()).toBeDisabled();
    type(ja.start.field.title, '序章を書く');
    fireEvent.click(await next());
    expect(await next()).toBeDisabled();
    type(ja.start.field.rough, '見出しだけ');
    fireEvent.click(await next());
    const saveStart = await screen.findByRole('button', { name: ja.start.saveStart });
    expect(saveStart).toBeDisabled();
    type(ja.start.field.first, 'エディタを開く');
    expect(saveStart).toBeEnabled();
    fireEvent.click(screen.getByRole('radio', { name: ja.start.tomorrow }));
    fireEvent.click(screen.getByRole('button', { name: ja.start.save }));
    await waitFor(async () => expect(await db.tasks.count()).toBe(1));
    expect((await db.tasks.toArray())[0]).toMatchObject({
      title: '序章を書く',
      roughVersion: '見出しだけ',
      firstAction: 'エディタを開く',
      plannedFor: '2026-10-19',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('?start=1 では「保存して始める」だけを出し、保存するとタイマーへ移る', async () => {
    const { router } = renderAt('/tasks/new?start=1');
    await screen.findByLabelText(ja.start.field.title);
    type(ja.start.field.title, '序章');
    fireEvent.click(screen.getByRole('button', { name: ja.common.next }));
    await screen.findByLabelText(ja.start.field.rough);
    type(ja.start.field.rough, '見出し');
    fireEvent.click(screen.getByRole('button', { name: ja.common.next }));
    await screen.findByLabelText(ja.start.field.first);
    type(ja.start.field.first, '開く');
    expect(screen.queryByRole('button', { name: ja.start.save })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: ja.start.saveStart }));
    await waitFor(async () => expect(await db.sessions.count()).toBe(1));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/session\//));
  });
});

describe('やることの詳細', () => {
  it('セッションの履歴と終わり方、詰まりを出し、片づけられる', async () => {
    const t = await createTask(taskInput({ title: '序章' }), true, NOW - 60 * MIN);
    const s = await startSession(t.id, true, null, NOW - 60 * MIN);
    await db.sessions.update(s.id, { endedAt: NOW - 56 * MIN, outcome: 'stopped' });
    await db.stuckLogs.add({ id: 'k', sessionId: s.id, taskId: t.id, at: NOW - 57 * MIN, blocker: '構成', choice: 'stop' });
    renderAt(`/tasks/${t.id}`);
    const history = await screen.findByTestId('session-history');
    expect(history).toHaveTextContent('10/18(日) 11:00 4分 止めた');
    expect(screen.getByTestId('task-detail')).toHaveTextContent('構成');
    fireEvent.click(screen.getByRole('button', { name: ja.start.close }));
    fireEvent.click(screen.getByRole('radio', { name: ja.start.closeDone }));
    await waitFor(async () => expect(await db.tasks.get(t.id)).toMatchObject({ closedReason: 'done', archivedAt: NOW }));
  });

  it('記録庫からやることの一覧へ移り、予定と片づけ済みで絞り込める', async () => {
    await createTask(taskInput({ title: '予定の' }), true, NOW);
    const done = await createTask(taskInput({ title: '済んだ' }), true, NOW);
    await db.tasks.update(done.id, { archivedAt: NOW, closedReason: 'done' });
    renderAt('/library/tasks');
    const list = await screen.findByTestId('task-list');
    expect(list).toHaveTextContent('予定の');
    expect(list).not.toHaveTextContent('済んだ');
    fireEvent.click(screen.getByRole('radio', { name: ja.start.list.closed }));
    expect(screen.getByTestId('task-list')).toHaveTextContent('済んだ');
  });
});
