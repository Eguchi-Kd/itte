import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { taskInput, testDb as db } from '../../db/__tests__/helpers';
import { createGoal, saveMetric } from '../../db/repo/goals';
import { createTask } from '../../db/repo/start';
import { NOW, renderAt, resetDb } from './testUtils';

const DAY = 86_400_000;
let goalId = '';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
  const m = await saveMetric({ name: '章数', unit: '章', direction: 'HIGHER_IS_BETTER', collectionMethod: '数える', verifiable: true }, NOW);
  goalId = (
    await createGoal(
      { metricId: m.id, title: '章を3つ', targetValue: 3, comparator: 'GTE', deadline: '2026-10-25', onMet: 'a', onUnmet: 'b', probability: 50, predictedValue: 3 },
      NOW,
    )
  ).id;
});

afterEach(() => {
  vi.useRealTimers();
});

const affectCount = async () => (await db.predictions.toArray()).filter((p) => p.kind === 'AFFECT').length;

describe('感情予想の開始前シート', () => {
  it('AC-START-12: 段に紐づいたやることの開始前シートが、同じ段について1日1回だけ出る。「とばして始める」でもセッションが始まり、予想は作られない', async () => {
    const t = await createTask(taskInput({ title: '序章', goalId }), true, NOW);
    const first = renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: '序章を始める' }));
    const sheet = await screen.findByTestId('affect-sheet');
    expect(sheet).toHaveAccessibleName(ja.start.affectQ);
    const record = within(sheet).getByRole('button', { name: ja.start.affectRecordStart });
    const skip = within(sheet).getByRole('button', { name: ja.start.affectSkipStart });
    expect(record.className).toBe(skip.className.replace('btn-secondary', 'btn-primary'));
    fireEvent.click(skip);
    await waitFor(async () => expect(await db.sessions.count()).toBe(1));
    await waitFor(() => expect(first.router.state.location.pathname).toMatch(/^\/session\//));
    expect(await affectCount()).toBe(0);
    cleanup();

    // 同じ日の2回目はシートを出さずにすぐ始まる
    const second = renderAt(`/tasks/${t.id}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.today.node.start }));
    await waitFor(async () => expect(await db.sessions.count()).toBe(2));
    expect(screen.queryByTestId('affect-sheet')).toBeNull();
    await waitFor(() => expect(second.router.state.location.pathname).toMatch(/^\/session\//));
    cleanup();

    // 翌日（論理日）はまた出る。「記録して始める」で AFFECT 予想がセッションつきで作られる
    vi.setSystemTime(NOW + DAY);
    renderAt(`/tasks/${t.id}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.today.node.start }));
    const next = await screen.findByTestId('affect-sheet');
    fireEvent.click(within(next).getByRole('radio', { name: '6' }));
    fireEvent.click(within(next).getByRole('radio', { name: '10分' }));
    fireEvent.click(within(next).getByRole('button', { name: ja.start.affectRecordStart }));
    await waitFor(async () => expect(await affectCount()).toBe(1));
    const p = (await db.predictions.toArray()).find((x) => x.kind === 'AFFECT');
    const s = await db.sessions.get(p?.sessionId ?? '');
    expect(p).toMatchObject({ goalId, value: { intensity: 6, durationMin: 10 } });
    expect(s?.affectPredictionId).toBe(p?.id);
  });

  it('段に紐づいていないやることでは出さない', async () => {
    await createTask(taskInput({ title: '単独' }), true, NOW);
    const { router } = renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: '単独を始める' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/session\//));
    expect(screen.queryByTestId('affect-sheet')).toBeNull();
  });

  it('終了画面で実際のしんどさと続いた時間を聞き、記録すると実際の値が追記される', async () => {
    const t = await createTask(taskInput({ title: '序章', goalId }), true, NOW - 11 * 60_000);
    renderAt(`/tasks/${t.id}`);
    vi.setSystemTime(NOW - 11 * 60_000);
    fireEvent.click(await screen.findByRole('button', { name: ja.today.node.start }));
    const sheet = await screen.findByTestId('affect-sheet');
    fireEvent.click(within(sheet).getByRole('radio', { name: '7' }));
    fireEvent.click(within(sheet).getByRole('radio', { name: ja.start.affectMore }));
    fireEvent.click(within(sheet).getByRole('button', { name: ja.start.affectRecordStart }));
    await waitFor(async () => expect(await db.sessions.count()).toBe(1));
    const session = (await db.sessions.toArray())[0];
    cleanup();

    vi.setSystemTime(NOW);
    renderAt(`/session/${session.id}/end`);
    const actual = await screen.findByTestId('affect-actual');
    fireEvent.click(within(actual).getByRole('radio', { name: '3' }));
    fireEvent.click(within(actual).getByRole('radio', { name: '5分' }));
    fireEvent.click(screen.getByRole('button', { name: ja.start.stop }));
    fireEvent.change(screen.getByLabelText(ja.start.nextQ), { target: { value: '続きを書く' } });
    fireEvent.click(screen.getByRole('button', { name: ja.common.confirm }));
    await waitFor(async () => expect(await db.affectActuals.count()).toBe(1));
    expect((await db.affectActuals.toArray())[0]).toMatchObject({ predictionId: session.affectPredictionId, intensity: 3, durationMin: 5 });
    expect((await db.predictions.get(session.affectPredictionId ?? ''))?.value).toEqual({ intensity: 7, durationMin: 60 });
  });
});
