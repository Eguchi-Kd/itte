import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { habitDraft, testDb as db } from '../../db/__tests__/helpers';
import { saveHabit, setHabitStatus } from '../../db/repo/habits';
import type { HabitLog } from '../../domain/types';
import { NOW, renderAt, resetDb } from './testUtils';

const DAY = 86400000;

function log(habitId: string, date: string, amount: number, done = true): HabitLog {
  return { id: `${habitId}-${date}`, habitId, date, done, amount: done ? amount : 0, reasonTagIds: [], memo: null, recordedAt: NOW };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW); // 2026-10-18（日）12:00
  await resetDb({ onboarded: true });
});

afterEach(() => {
  vi.useRealTimers();
});

/** 月水金の習慣（10/04 開始）。予定日 6日のうち4日やった（45分）＋予定外の土曜に10分 */
async function seedHabit() {
  const h = await saveHabit(
    habitDraft({ name: '英単語', unit: '分', amount: 10, schedule: { days: [1, 3, 5], time: '07:00', cue: null } }),
    NOW - 14 * DAY,
  );
  const tired = (await db.reasonTags.toArray()).find((t) => t.label === '疲れ');
  await db.habitLogs.bulkAdd([
    log(h.id, '2026-10-05', 15),
    log(h.id, '2026-10-07', 10),
    log(h.id, '2026-10-12', 10),
    log(h.id, '2026-10-16', 10),
    log(h.id, '2026-10-17', 10),
    { ...log(h.id, '2026-10-14', 0, false), reasonTagIds: tired ? [tired.id] : [] },
  ]);
  return h;
}

describe('習慣の詳細', () => {
  it('AC-HAB-15: 累積量と「28日間で {done}/{scheduled} 回」が表示され、連続日数が表示されない', async () => {
    const h = await seedHabit();
    renderAt(`/habits/${h.id}`);
    const detail = await screen.findByTestId('habit-detail');
    expect(within(detail).getByTestId('total')).toHaveTextContent('これまで合計 55分');
    expect(within(detail).getByTestId('ratio28')).toHaveTextContent('28日間で 4/6 回');
    expect(detail.textContent).not.toMatch(/連続|日続けて|日目/);
    expect(within(detail).getByTestId('intention')).toHaveTextContent('月・水・金曜の7:00に、机で、英単語を10分');
    // 割合のゲージを出さない
    expect(within(detail).queryByRole('progressbar')).toBeNull();
    expect(within(detail).queryByRole('meter')).toBeNull();
  });

  it('AC-HAB-15: 「28日間」は今日を含む28日（9/21〜10/18）だけを数え、累積量はそれより前も含む', async () => {
    const h = await saveHabit(
      habitDraft({ name: '散歩', unit: '分', amount: 10, schedule: { days: [0, 1], time: null, cue: '朝食のあと' } }),
      NOW - 47 * DAY,
    );
    // 9/20（日）は窓の外、9/21（月）は窓の内側
    await db.habitLogs.bulkAdd([log(h.id, '2026-09-20', 10), log(h.id, '2026-09-21', 10), log(h.id, '2026-10-12', 10)]);
    renderAt(`/habits/${h.id}`);
    const detail = await screen.findByTestId('habit-detail');
    // 予定日: 月 9/21・9/28・10/5・10/12、日 9/27・10/4・10/11（今日 10/18 は記録なしなので分母に入れない）
    expect(within(detail).getByTestId('ratio28')).toHaveTextContent('28日間で 2/7 回');
    expect(within(detail).getByTestId('total')).toHaveTextContent('これまで合計 30分');
  });

  it('記録なしの理由の内訳、月間カレンダー（予定日・記録済み・予定外の実行）を出す', async () => {
    const h = await seedHabit();
    renderAt(`/habits/${h.id}`);
    const reasons = await screen.findByTestId('reasons');
    expect(reasons).toHaveTextContent('疲れ');
    expect(reasons).toHaveTextContent('1件');
    const cal = screen.getByTestId('month-calendar');
    expect(within(cal).getByRole('gridcell', { name: '10/16(金) 記録済み' })).toHaveAttribute('data-state', 'done');
    expect(within(cal).getByRole('gridcell', { name: '10/17(土) 予定外の実行' })).toHaveAttribute('data-state', 'extra');
    expect(within(cal).getByRole('gridcell', { name: '10/14(水) 予定日' })).toHaveAttribute('data-state', 'scheduled');
    expect(await screen.findByTestId('weekly-chart')).toBeInTheDocument();
  });

  it('time があるときだけ「カレンダーに書き出す」を出す', async () => {
    const h = await seedHabit();
    const cue = await saveHabit(habitDraft({ name: '読書', schedule: { days: [0], time: null, cue: '寝る前' } }), NOW);
    const { unmount } = renderAt(`/habits/${h.id}`);
    expect(await screen.findByRole('button', { name: ja.habits.exportIcs })).toBeInTheDocument();
    unmount();
    renderAt(`/habits/${cue.id}`);
    await screen.findByTestId('habit-detail');
    expect(screen.queryByRole('button', { name: ja.habits.exportIcs })).toBeNull();
  });

  it('「終了する」で ended になり「再開する」で active に戻る', async () => {
    const h = await seedHabit();
    renderAt(`/habits/${h.id}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.habits.end }));
    await waitFor(async () => expect((await db.habits.get(h.id))?.status).toBe('ended'));
    fireEvent.click(await screen.findByRole('button', { name: ja.habits.resume }));
    await waitFor(async () => expect((await db.habits.get(h.id))?.status).toBe('active'));
  });

  it('量を上げる提案を出し、「上げる」で量と amountChangedOn を変える', async () => {
    const h = await saveHabit(habitDraft({ amount: 10 }), NOW - 30 * DAY);
    await db.habitLogs.bulkAdd(
      Array.from({ length: 13 }, (_, i) => log(h.id, `2026-10-${String(5 + i).padStart(2, '0')}`, 10)),
    );
    renderAt(`/habits/${h.id}`);
    const card = await screen.findByTestId('level-up');
    expect(card).toHaveTextContent('量を 12分 に上げてみませんか');
    fireEvent.click(within(card).getByRole('button', { name: ja.habits.levelUpAccept }));
    await waitFor(async () => expect(await db.habits.get(h.id)).toMatchObject({ amount: 12, amountChangedOn: '2026-10-18' }));
  });
});

describe('習慣の編集', () => {
  it('既存の値を初期値にし、量を変えて保存すると amountChangedOn が今日になる', async () => {
    const h = await saveHabit(habitDraft({ name: '英単語', amount: 10 }), NOW - 20 * DAY);
    const { router } = renderAt(`/habits/${h.id}/edit`);
    const name = await screen.findByLabelText(ja.habits.field.name);
    expect(name).toHaveValue('英単語');
    fireEvent.change(screen.getByLabelText(ja.habits.field.amount), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: ja.habits.edit.save }));
    await waitFor(async () => expect(await db.habits.get(h.id)).toMatchObject({ amount: 15, amountChangedOn: '2026-10-18' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/habits/${h.id}`));
  });

  it('入力が無効なら保存できない', async () => {
    const h = await saveHabit(habitDraft(), NOW);
    renderAt(`/habits/${h.id}/edit`);
    fireEvent.change(await screen.findByLabelText(ja.habits.field.name), { target: { value: '' } });
    expect(screen.getByRole('button', { name: ja.habits.edit.save })).toBeDisabled();
  });
});

describe('習慣の一覧', () => {
  it('「実行中」「定着済み」「終了」の3セクションに分け、各行に「28日間で」を出す', async () => {
    const h = await seedHabit();
    const g = await saveHabit(habitDraft({ name: '散歩' }), NOW);
    await setHabitStatus(g.id, 'graduated', null, NOW);
    renderAt('/library/habits');
    const active = await screen.findByTestId('habit-section-active');
    expect(active).toHaveTextContent('英単語');
    expect(active).toHaveTextContent('28日間で 4/6 回');
    expect(screen.getByTestId('habit-section-graduated')).toHaveTextContent('散歩');
    expect(screen.getByTestId('habit-section-ended')).toHaveTextContent(ja.habits.list.empty);
    expect(screen.getByTestId('habit-new')).toHaveAttribute('href', '/habits/new');
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
    fireEvent.click(within(active).getByRole('link', { name: /英単語/ }));
    expect(await screen.findByTestId('habit-detail')).toBeInTheDocument();
    expect(h.id).toBeTruthy();
  });

  it('記録庫から習慣の一覧へ移れる', async () => {
    const { router } = renderAt('/library');
    fireEvent.click(await screen.findByRole('link', { name: new RegExp(ja.habits.list.title) }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/library/habits'));
  });
});
