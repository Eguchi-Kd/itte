import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { habitDraft, testDb as db } from '../../db/__tests__/helpers';
import { createMove } from '../../db/repo/board';
import { saveHabit } from '../../db/repo/habits';
import type { HabitLog } from '../../domain/types';
import { NOW, renderAt, resetDb } from './testUtils';

const DAY = 86_400_000;
const WEEK = '2026-10-12';
const cand = (description: string) => ({ description, plus1: null, plus2: null, score: null });
const next = () => screen.getByRole('button', { name: ja.common.next });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
});

afterEach(() => {
  vi.useRealTimers();
});

async function seed() {
  const habit = await saveHabit(habitDraft({ name: '英単語' }), NOW - 3 * DAY);
  const { move } = await createMove(
    { situation: '誘いへの返事', triggerId: null, irreversible: false, unreadable: false, candidates: [cand('行く'), cand('断る')] },
    NOW - DAY,
  );
  return { habit, move };
}

function answerHabit() {
  for (const q of ja.review.autoQ) {
    const group = screen.getByRole('radiogroup', { name: q });
    fireEvent.click(within(group).getAllByRole('radio')[3]);
  }
}

describe('週次ふりかえりのレッスン', () => {
  it('AC-REV-03: カードは1枚ごとに保存され、途中で閉じて開き直すと続きのカードから始まる', async () => {
    const { move } = await seed();
    renderAt(`/review/weekly/${WEEK}`);
    expect(await screen.findByTestId('weekly-facts')).toHaveTextContent('英単語');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4'); // 数字・感想戦・習慣・しめ
    fireEvent.click(next());

    // 感想戦のカード: 保存するとその場で記録される
    await screen.findByTestId('review-move');
    fireEvent.click(screen.getByRole('radio', { name: ja.start.yes }));
    fireEvent.click(screen.getByRole('radio', { name: ja.review.neutral }));
    fireEvent.click(screen.getByRole('button', { name: ja.review.move.save }));
    await waitFor(async () => expect(await db.moveReviews.count()).toBe(1));
    expect(await db.moveReviews.toArray()).toMatchObject([{ moveId: move.id, rating: 'neutral', judgmentOk: true }]);
    await waitFor(async () => expect((await db.weeklyReviewRuns.toArray())[0]?.cursor).toBe(2));

    // 閉じて開き直すと、習慣のカード（3枚目）から始まる
    cleanup();
    renderAt(`/review/weekly/${WEEK}`);
    expect(await screen.findByRole('radiogroup', { name: ja.review.autoQ[0] })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  });

  it('AC-REV-05: 最後のカードで completedAt が入り、ホームのノードが完了になる', async () => {
    await seed();
    const { router } = renderAt(`/review/weekly/${WEEK}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.common.next }));
    fireEvent.click(await screen.findByRole('radio', { name: ja.start.no }));
    fireEvent.click(screen.getByRole('radio', { name: ja.review.good }));
    fireEvent.click(screen.getByRole('button', { name: ja.review.move.save }));
    await screen.findByRole('radiogroup', { name: ja.review.autoQ[0] });
    answerHabit();
    fireEvent.click(screen.getByRole('button', { name: ja.review.habit.save }));
    // しめのカードは、保存した感想戦をライブクエリで読み直してから数を出す
    await waitFor(() => expect(screen.getByTestId('weekly-close')).toHaveTextContent('悪手の割合 0%（1件中0件）'));
    expect((await db.weeklyReviewRuns.toArray())[0].completedAt).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: ja.review.close.finish }));
    await waitFor(async () => expect((await db.weeklyReviewRuns.toArray())[0].completedAt).toBe(NOW));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByTestId('weekly-node')).toHaveAttribute('data-state', 'done');
    expect(await db.weeklyChecks.toArray()).toMatchObject([{ weekStart: WEEK, automaticity: [4, 4, 4, 4], habitReview: null }]);
  });

  it('AC-BOARD-15: 悪手のときは見落としを選ばないと保存できず、「判断は妥当だった?」と「結果は?」は別々の入力欄', async () => {
    await seed();
    renderAt(`/review/weekly/${WEEK}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.common.next }));
    await screen.findByTestId('review-move');
    expect(screen.getByRole('radiogroup', { name: ja.review.judgmentOkQ })).toBeInTheDocument();
    const outcome = screen.getByTestId('review-outcome');
    expect(outcome.closest('[role="radiogroup"]')).toBeNull();
    fireEvent.change(outcome, { target: { value: '疲れが残った' } });
    fireEvent.click(screen.getByRole('radio', { name: ja.start.yes }));
    fireEvent.click(screen.getByRole('radio', { name: ja.review.bad }));
    const save = screen.getByRole('button', { name: ja.review.move.save });
    expect(save).toBeDisabled();
    expect(screen.getByText(ja.errors.badNeedsBlindSpot)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: ja.review.reading }));
    fireEvent.click(screen.getByRole('switch', { name: ja.review.promote }));
    expect(save).toBeDisabled(); // 原則の1行が空
    fireEvent.change(screen.getByLabelText(ja.review.move.principle), { target: { value: '誘いは一晩おく' } });
    fireEvent.click(save);
    await waitFor(async () => expect(await db.moveReviews.count()).toBe(1));
    expect((await db.moveReviews.toArray())[0]).toMatchObject({ judgmentOk: true, outcome: '疲れが残った', rating: 'bad', blindSpot: 'reading' });
    expect((await db.joseki.toArray()).find((j) => j.principle === '誘いは一晩おく')).toMatchObject({ origin: 'review' });
  });

  it('定期レビューの対象なら有用性と継続／縮小／終了を同じ見た目で出し、「やめる」で習慣を終了する', async () => {
    const h = await saveHabit(habitDraft({ name: '腹筋', purpose: '姿勢' }), NOW - 40 * DAY);
    renderAt(`/review/weekly/${WEEK}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.common.next }));
    await screen.findByRole('radiogroup', { name: ja.review.autoQ[0] });
    answerHabit();
    const review = screen.getByTestId('habit-review');
    expect(review).toHaveTextContent('目的: 姿勢');
    expect(review).toHaveTextContent(ja.review.quitNote);
    const decisions = within(within(review).getByRole('radiogroup', { name: ja.review.habit.decisionQ })).getAllByRole('radio');
    expect(decisions.map((d) => d.textContent)).toEqual([ja.review.keep, ja.review.reduce, ja.review.quit]);
    expect(new Set(decisions.map((d) => d.className)).size).toBe(1);
    expect(screen.getByRole('button', { name: ja.review.habit.save })).toBeDisabled();
    fireEvent.click(within(within(review).getByRole('radiogroup', { name: ja.review.usefulQ })).getAllByRole('radio')[1]);
    fireEvent.click(within(within(review).getByRole('radiogroup', { name: ja.review.againQ })).getByRole('radio', { name: ja.start.no }));
    fireEvent.click(decisions[2]);
    fireEvent.click(screen.getByRole('button', { name: ja.review.habit.save }));
    await waitFor(async () => expect((await db.habits.get(h.id))?.status).toBe('ended'));
  });

  it('傾向のある習慣には傾向と対策のカードを出し、対策を登録できる', async () => {
    const h = await saveHabit(habitDraft({ name: '英単語', schedule: { days: [1, 2, 3, 4, 5], time: null, cue: 'x' } }), NOW - 80 * DAY);
    const logs: HabitLog[] = [];
    for (let d = new Date(NOW - 77 * DAY); d.getTime() < NOW - DAY; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay();
      if (wd >= 1 && wd <= 4) {
        const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        logs.push({ id: s, habitId: h.id, date: s, done: true, amount: 10, reasonTagIds: [], memo: null, recordedAt: NOW });
      }
    }
    await db.habitLogs.bulkAdd(logs);
    renderAt(`/review/weekly/${WEEK}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.common.next }));
    await screen.findByRole('radiogroup', { name: ja.review.autoQ[0] });
    answerHabit();
    // 開始から28日以上たっているので定期レビューも答える
    const review = screen.getByTestId('habit-review');
    fireEvent.click(within(within(review).getByRole('radiogroup', { name: ja.review.usefulQ })).getAllByRole('radio')[3]);
    fireEvent.click(within(within(review).getByRole('radiogroup', { name: ja.review.againQ })).getByRole('radio', { name: ja.start.yes }));
    fireEvent.click(within(review).getByRole('radio', { name: ja.review.keep }));
    fireEvent.click(screen.getByRole('button', { name: ja.review.habit.save }));
    const line = await screen.findByTestId('pattern-weekday:5');
    expect(line).toHaveTextContent(/^金曜日は \d+回中0回（全体 \d+%）$/);
    fireEvent.change(screen.getByLabelText(ja.review.counter), { target: { value: '木曜の夜に準備する' } });
    fireEvent.click(screen.getByRole('button', { name: ja.review.pattern.save }));
    await waitFor(async () => expect(await db.countermeasures.toArray()).toMatchObject([{ conditionKey: 'weekday:5', conditionLabel: '金曜日', action: '木曜の夜に準備する' }]));
  });
});

describe('ふりかえりタブと傾向と対策', () => {
  it('今週のふりかえりの入口と過去の週、数字・較正・傾向と対策・実験への入口を出す', async () => {
    const { router } = renderAt('/review');
    const entry = await screen.findByTestId('weekly-entry');
    expect(entry).toHaveTextContent('10/12(月)の週');
    expect(screen.getByRole('link', { name: new RegExp(ja.review.calibration) })).toHaveAttribute('href', '/review/calibration');
    expect(screen.getByRole('link', { name: /10\/5\(月\)の週/ })).toBeInTheDocument();
    fireEvent.click(within(entry).getByRole('button', { name: ja.review.start }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/review/weekly/${WEEK}`));
  });

  it('傾向がなければコマと「まだ傾向を出せるだけのデータがありません」', async () => {
    await saveHabit(habitDraft({ name: '英単語' }), NOW - 3 * DAY);
    renderAt('/review/patterns');
    const page = await screen.findByTestId('patterns');
    expect(page).toHaveTextContent('英単語');
    expect(page).toHaveTextContent(ja.koma.noPattern);
    expect(within(page).getByTestId('koma')).toHaveAttribute('data-pose', 'sit');
  });
});
