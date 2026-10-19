import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { habitDraft, testDb as db } from '../../db/__tests__/helpers';
import { recordDone, saveHabit } from '../../db/repo/habits';
import { upsertWeeklyReviewRun } from '../../db/repo/common';
import { NOW, renderAt, resetDb } from './testUtils';

const DAY = 86400000;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW); // 2026-10-18（日）12:00
  await resetDb({ onboarded: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ホーム', () => {
  it('習慣が1件もなければ空の状態と「最初の1つをつくる」を出し、入口の4択を開く', async () => {
    renderAt('/');
    expect(await screen.findByTestId('empty-state')).toHaveTextContent(ja.koma.emptyHome);
    fireEvent.click(screen.getByRole('button', { name: ja.today.createFirst }));
    expect(screen.getByRole('dialog', { name: ja.onboarding.entryTitle })).toBeInTheDocument();
  });

  it('AC-UX-01: 「やった」1回のタップで記録が保存される（todo のノードでも）', async () => {
    const a = await saveHabit(habitDraft({ name: '英単語', schedule: { days: [0], time: '07:00', cue: null } }), NOW);
    const b = await saveHabit(habitDraft({ name: '読書', schedule: { days: [0], time: '21:00', cue: null } }), NOW);
    renderAt('/');
    const nodeB = await screen.findByTestId(`habit-node-${b.id}`);
    expect(nodeB).toHaveAttribute('data-state', 'todo');
    expect(screen.getByTestId(`habit-node-${a.id}`)).toHaveAttribute('data-state', 'next');
    fireEvent.click(within(nodeB).getByRole('button', { name: '読書をやったと記録する' }));
    await waitFor(async () => expect(await db.habitLogs.count()).toBe(1));
    expect((await db.habitLogs.toArray())[0]).toMatchObject({ habitId: b.id, date: '2026-10-18', done: true, amount: 10 });
    await waitFor(() => expect(screen.getByTestId(`habit-node-${b.id}`)).toHaveAttribute('data-state', 'done'));
    expect(screen.getByTestId('snackbar')).toHaveTextContent(ja.feedback.recorded);
  });

  it('AC-HAB-07: 「やった」→ スナックバーの「取り消す」で、その日の記録が消える', async () => {
    const h = await saveHabit(habitDraft(), NOW);
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: '英単語をやったと記録する' }));
    await waitFor(async () => expect(await db.habitLogs.count()).toBe(1));
    fireEvent.click(within(screen.getByTestId('snackbar')).getByRole('button', { name: ja.common.undo }));
    await waitFor(async () => expect(await db.habitLogs.count()).toBe(0));
    await waitFor(() => expect(screen.getByTestId(`habit-node-${h.id}`)).toHaveAttribute('data-state', 'next'));
  });

  it('記録済みのノードは「記録済み {量}」「取り消す」「追加で記録」を持ち、追加で量を足す', async () => {
    await upsertWeeklyReviewRun('2026-10-12', { completed: true }, NOW);
    const h = await saveHabit(habitDraft({ unit: '分', amount: 10 }), NOW);
    await recordDone(h.id, '2026-10-18', undefined, NOW);
    renderAt('/');
    const node = await screen.findByTestId(`habit-node-${h.id}`);
    expect(node).toHaveAttribute('data-state', 'done');
    expect(within(node).getByTestId('recorded')).toHaveTextContent('記録済み 10分');
    expect(screen.getByTestId('all-done')).toHaveTextContent(ja.today.allDone);
    fireEvent.click(within(node).getByRole('button', { name: ja.today.node.addMore }));
    await waitFor(async () => expect((await db.habitLogs.toArray())[0].amount).toBe(20));
    fireEvent.click(within(screen.getByTestId(`habit-node-${h.id}`)).getByRole('button', { name: ja.common.undo }));
    await waitFor(async () => expect(await db.habitLogs.count()).toBe(0));
  });

  it('AC-UX-03: 記録なしの理由カードで、タグ1回のタップで記録され、次のカードに進む', async () => {
    const h = await saveHabit(habitDraft({ name: '英単語' }), NOW - 5 * DAY);
    renderAt('/');
    const card = await screen.findByTestId('reason-card');
    expect(within(card).getByTestId('reason-question')).toHaveTextContent('10/15(木) 英単語 は記録なし。何があった?');
    fireEvent.click(within(card).getByRole('radio', { name: '疲れ' }));
    await waitFor(() =>
      expect(screen.getByTestId('reason-question')).toHaveTextContent('10/16(金) 英単語 は記録なし。何があった?'),
    );
    const logs = await db.habitLogs.toArray();
    expect(logs).toHaveLength(1);
    const tired = (await db.reasonTags.toArray()).find((t) => t.label === '疲れ');
    expect(logs[0]).toMatchObject({ habitId: h.id, date: '2026-10-15', done: false, amount: 0, reasonTagIds: [tired?.id] });

    fireEvent.click(within(screen.getByTestId('reason-card')).getByRole('radio', { name: ja.today.interrupt.noReason }));
    await waitFor(() => expect(screen.getByTestId('reason-question')).toHaveTextContent('10/17(土)'));
    fireEvent.click(within(screen.getByTestId('reason-card')).getByRole('radio', { name: '忘れた' }));
    await waitFor(() => expect(screen.queryByTestId('reason-card')).toBeNull());
    expect(await db.habitLogs.count()).toBe(3);
  });

  it('理由カードの「あとで」は、その論理日の間は出さない', async () => {
    await saveHabit(habitDraft(), NOW - 2 * DAY);
    renderAt('/');
    const card = await screen.findByTestId('reason-card');
    fireEvent.click(within(card).getByRole('button', { name: ja.common.later }));
    await waitFor(() => expect(screen.queryByTestId('reason-card')).toBeNull());
    const s = await db.settings.get('singleton');
    expect(s?.dismissed).toEqual({ reason: '2026-10-18' });
  });

  it('過去の記録を直す: 過去3日と今日だけを選べ、選んだ日に「やった」を記録できる', async () => {
    const h = await saveHabit(habitDraft(), NOW - 10 * DAY);
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: ja.today.fixPast }));
    const sheet = screen.getByTestId('past-sheet');
    const chips = within(sheet).getAllByRole('radio');
    expect(chips.map((c) => c.textContent)).toEqual(['10/18(日)', '10/17(土)', '10/16(金)', '10/15(木)']);
    fireEvent.click(within(sheet).getByRole('radio', { name: '10/16(金)' }));
    fireEvent.click(within(within(sheet).getByTestId(`past-${h.id}`)).getByRole('button', { name: ja.today.past.done }));
    await waitFor(async () => expect(await db.habitLogs.count()).toBe(1));
    expect((await db.habitLogs.toArray())[0]).toMatchObject({ date: '2026-10-16', done: true });
  });

  it('今日は予定のない習慣を折りたたみに出し、予定外の日の実行を記録できる', async () => {
    await saveHabit(habitDraft({ name: '筋トレ', schedule: { days: [1, 3], time: null, cue: '帰宅後' } }), NOW);
    renderAt('/');
    const box = await screen.findByTestId('unscheduled');
    expect(box).toHaveTextContent(ja.today.unscheduledHabits);
    fireEvent.click(within(box).getByRole('button', { name: ja.today.node.done }));
    await waitFor(async () => expect(await db.habitLogs.count()).toBe(1));
  });

  it('＋ でクイックアクションを開き、「習慣・段」→「習慣をつくる」で習慣作成へ移る', async () => {
    const { router } = renderAt('/');
    fireEvent.click(await screen.findByTestId('nav-add'));
    const sheet = screen.getByTestId('quick-sheet');
    expect(within(sheet).getAllByRole('button').filter((b) => b.dataset.testid?.startsWith('quick-'))).toHaveLength(6);
    fireEvent.click(within(sheet).getByTestId('quick-create'));
    fireEvent.click(screen.getByRole('button', { name: ja.today.createHabit }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/habits/new'));
  });
});
