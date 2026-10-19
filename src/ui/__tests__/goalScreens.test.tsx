import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { testDb as db } from '../../db/__tests__/helpers';
import { createGoal, judge, saveMetric } from '../../db/repo/goals';
import { dayStart } from '../../domain/dates';
import type { GoalInput } from '../../domain/goals/goal';
import { NOW, renderAt, resetDb } from './testUtils';

const next = () => screen.getByRole('button', { name: ja.common.next });
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

let metricId = '';
function input(p: Partial<GoalInput> = {}): GoalInput {
  return {
    metricId,
    title: '章を3つ',
    targetValue: 3,
    comparator: 'GTE',
    deadline: '2026-10-25',
    onMet: '次へ',
    onUnmet: '絞る',
    probability: 60,
    predictedValue: 3,
    ...p,
  };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
  metricId = (await saveMetric({ name: '書いた章数', unit: '章', direction: 'HIGHER_IS_BETTER', collectionMethod: '数える', verifiable: true }, NOW)).id;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('段の登録', () => {
  it('5ステップすべてが埋まるまで保存できず、確認の文を出して「この段を立てる」で段・決めておくこと・予想を作る', async () => {
    const { router } = renderAt('/goals/new');
    expect(await screen.findByText(ja.goals.luckNote)).toBeInTheDocument();
    expect(next()).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: ja.goals.newMetric }));
    type(ja.goals.field.metricName, '睡眠の遅れ');
    type(ja.goals.field.unit, '分');
    fireEvent.click(screen.getByRole('radio', { name: ja.goals.lower }));
    expect(next()).toBeDisabled(); // 取得方法が空
    type(ja.goals.collection, '寝た時刻を記録する');
    fireEvent.click(next());

    type(ja.goals.field.title, '寝る時刻をそろえる');
    expect(next()).toBeDisabled();
    type(ja.goals.field.target, '30');
    // 少ないほど良い指標なので、比較は「以下」が既定
    expect(screen.getByRole('radio', { name: ja.goals.comparators.LTE })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('goal-preview')).toHaveTextContent('睡眠の遅れが 30分 以下');
    fireEvent.click(next());

    expect(next()).toBeDisabled(); // 期限なしでは進めない
    fireEvent.click(screen.getByRole('radio', { name: ja.goals.dateChips.week1 }));
    fireEvent.click(next());

    type(ja.goals.onMet, '目安を20分にする');
    expect(next()).toBeDisabled();
    type(ja.goals.onUnmet, '寝る前の画面を切る');
    fireEvent.click(next());

    fireEvent.click(screen.getByRole('radio', { name: '70%' }));
    expect(next()).toBeDisabled();
    type(ja.goals.predictedValue, '25');
    fireEvent.click(next());

    expect(screen.getByTestId('goal-confirm')).toHaveTextContent('10/25(日) に、睡眠の遅れが 30分 以下かを確かめる');
    fireEvent.click(screen.getByRole('button', { name: ja.goals.create }));
    await waitFor(async () => expect(await db.goals.count()).toBe(1));
    const g = (await db.goals.toArray())[0];
    expect(g).toMatchObject({ title: '寝る時刻をそろえる', targetValue: 30, comparator: 'LTE', deadline: '2026-10-25', status: 'OPEN' });
    expect(await db.metrics.count()).toBe(2);
    expect(await db.commitments.where('goalId').equals(g.id).count()).toBe(2);
    expect(await db.predictions.where('goalId').equals(g.id).toArray()).toMatchObject([{ kind: 'OUTCOME', value: { probability: 70, value: 25 } }]);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/goals/${g.id}`));
  });
});

describe('刻む・切り直す', () => {
  it('判定前の段からは刻めない（入れない）', async () => {
    const g = await createGoal(input(), NOW);
    renderAt(`/goals/${g.id}/kizami`);
    expect(await screen.findByTestId('followup-blocked')).toHaveTextContent(ja.errors.parentOpen);
  });

  it('届かなかった段から刻むと、上部に元の段を出し、指標は元と同じものを初期値にして子の段を作る', async () => {
    const parent = await createGoal(input({ deadline: '2026-10-15' }), dayStart('2026-10-05'));
    await judge(parent.id, 1, { investedHours: 5, costNote: '時間' }, { enforced: true }, NOW);
    renderAt(`/goals/${parent.id}/kizami`);
    expect(await screen.findByTestId('lesson-band')).toHaveTextContent('元の段: 章を3つ');
    expect(screen.getByRole('radio', { name: '書いた章数' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(next());
    type(ja.goals.field.title, '1章だけ');
    type(ja.goals.field.target, '1');
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('radio', { name: ja.goals.dateChips.week2 }));
    fireEvent.click(next());
    type(ja.goals.onMet, 'a');
    type(ja.goals.onUnmet, 'b');
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('radio', { name: '50%' }));
    type(ja.goals.predictedValue, '1');
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('button', { name: ja.goals.create }));
    await waitFor(async () => expect(await db.goals.count()).toBe(2));
    const child = (await db.goals.toArray()).find((x) => x.id !== parent.id);
    expect(child).toMatchObject({ parentId: parent.id, recutOfId: null, metricId });
    expect((await db.goals.get(parent.id))?.status).toBe('UNMET');
  });
});

describe('期限の延長', () => {
  it('新しい期限と理由がそろうまで延ばせず、延ばすと期限が変わる', async () => {
    const g = await createGoal(input(), NOW);
    renderAt(`/goals/${g.id}/extend`);
    const save = await screen.findByRole('button', { name: ja.goals.extendForm.save });
    fireEvent.click(screen.getByRole('radio', { name: ja.goals.dateChips.month1 }));
    expect(save).toBeDisabled();
    type(ja.goals.reasonQ, '発表の準備が入った');
    fireEvent.click(save);
    await waitFor(async () => expect((await db.goals.get(g.id))?.deadline).toBe('2026-11-18'));
    expect(await db.deadlineExtensions.count()).toBe(1);
  });

  it('期限日を過ぎた段には延長の画面を出さない', async () => {
    const g = await createGoal(input({ deadline: '2026-10-15' }), dayStart('2026-10-05'));
    renderAt(`/goals/${g.id}/extend`);
    expect(await screen.findByTestId('extend-blocked')).toHaveTextContent(ja.errors.extendPast);
  });
});

describe('実測の記録', () => {
  it('「確かめる」→ 確認シート →「記録する」の2段で記録し、「入力を直す」では記録しない', async () => {
    renderAt('/measure/new');
    fireEvent.click(await screen.findByRole('radio', { name: '書いた章数' }));
    type(ja.goals.field.value, '2');
    fireEvent.click(screen.getByRole('button', { name: ja.common.check }));
    const sheet = screen.getByTestId('check-sheet');
    expect(sheet).toHaveAccessibleName(ja.goals.measure.check);
    expect(sheet).toHaveTextContent('書いた章数 2章');
    fireEvent.click(within(sheet).getByRole('button', { name: ja.common.fix }));
    expect(screen.queryByTestId('check-sheet')).toBeNull();
    expect(await db.measurements.count()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: ja.common.check }));
    fireEvent.click(within(screen.getByTestId('check-sheet')).getByRole('button', { name: ja.goals.measure.record }));
    await waitFor(async () => expect(await db.measurements.toArray()).toMatchObject([{ metricId, value: 2, source: 'manual' }]));
  });

  it('指標の一覧に最新の実測を出す', async () => {
    renderAt('/library/metrics');
    expect(await screen.findByTestId('metric-list')).toHaveTextContent(ja.goals.metrics.none);
  });
});
