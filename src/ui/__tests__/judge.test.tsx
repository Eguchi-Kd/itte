import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { testDb as db } from '../../db/__tests__/helpers';
import { createGoal, detectDueGoals, extendDeadline, judge, recordMeasurement, saveMetric, syncStallFlags } from '../../db/repo/goals';
import { dayStart } from '../../domain/dates';
import type { GoalInput } from '../../domain/goals/goal';
import type { Goal } from '../../domain/types';
import { NOW, renderAt, resetDb } from './testUtils';

let metricId = '';
function input(p: Partial<GoalInput> = {}): GoalInput {
  return {
    metricId,
    title: '章を3つ書く',
    targetValue: 3,
    comparator: 'GTE',
    deadline: '2026-10-15',
    onMet: '次の章の構成を作る',
    onUnmet: '1章だけに絞る',
    probability: 60,
    predictedValue: 3,
    ...p,
  };
}
const pastGoal = (p: Partial<GoalInput> = {}) => createGoal(input(p), dayStart('2026-10-05'));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
  metricId = (await saveMetric({ name: '書いた章数', unit: '章', direction: 'HIGHER_IS_BETTER', collectionMethod: '数える', verifiable: true }, NOW)).id;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('判定のレッスン', () => {
  it('AC-GOAL-13: 判定画面の DOM で、決めておいたことの表示が実測の入力欄より前に現れる', async () => {
    const g = await pastGoal();
    await recordMeasurement({ metricId, value: 2, measuredAt: dayStart('2026-10-14') + 3600_000, note: null }, NOW);
    renderAt(`/judge/${g.id}`);
    const commitments = await screen.findByTestId('judge-commitments');
    const actual = screen.getByTestId('judge-actual');
    expect(commitments).toHaveTextContent('次の章の構成を作る');
    expect(commitments).toHaveTextContent('1章だけに絞る');
    expect(commitments.compareDocumentPosition(actual) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 参考の最新の実測は出すが、入力欄には初期値を入れない
    expect(actual).toHaveValue('');
    expect(screen.getByText('最新の実測: 2章（10/14(水)）')).toBeInTheDocument();
    expect(screen.queryByTestId('koma')).toBeNull();
  });

  it('AC-GOAL-12: 届かなかった判定のレッスンは、刻む／切り直す／取り下げるのどれかを選ばないと完了しない', async () => {
    const g = await pastGoal();
    renderAt(`/judge/${g.id}`);
    fireEvent.change(await screen.findByTestId('judge-actual'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: ja.common.check }));
    const sheet = screen.getByTestId('check-sheet');
    expect(within(sheet).getByTestId('judge-check-line')).toHaveTextContent('2章。3章 以上に 届かなかった');
    expect(sheet).toHaveAccessibleName(ja.goals.irreversibleNote);
    fireEvent.click(within(sheet).getByRole('button', { name: ja.common.confirm }));

    // 届かなかった場合: かけた時間と失ったものが両方そろうまで確定できない
    const confirm = await screen.findByRole('button', { name: ja.common.confirm });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByTestId('judge-hours'), { target: { value: '12' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByTestId('judge-cost'), { target: { value: '週末の予定' } });
    fireEvent.click(confirm);
    await waitFor(async () => expect(await db.judgments.count()).toBe(1));
    expect((await db.judgments.toArray())[0]).toMatchObject({ outcome: 'UNMET', actualValue: 2, investedHours: 12, costNote: '週末の予定' });

    // 次はどうする? 3つのボタンを同じ見た目で並べる。選ぶまで完了画面にならない
    const group = await screen.findByRole('group', { name: ja.goals.followQ });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['刻む', '切り直す', '取り下げる']);
    expect(new Set(buttons.map((b) => b.className)).size).toBe(1);
    expect(screen.queryByTestId('judge-done')).toBeNull();
    expect(screen.queryByRole('button', { name: ja.common.confirm })).toBeNull();

    // 閉じて開き直しても、選ぶところから続く
    cleanup();
    renderAt(`/judge/${g.id}`);
    expect(await screen.findByRole('group', { name: ja.goals.followQ })).toBeInTheDocument();
    expect(screen.queryByTestId('judge-done')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: ja.goals.withdraw }));
    expect(await screen.findByTestId('judge-done')).toHaveTextContent('1章だけに絞る');
    expect(await db.goalFollowUps.toArray()).toMatchObject([{ goalId: g.id, choice: 'WITHDRAW' }]);
  });

  it('「刻む」を選ぶと刻むレッスンへ移る', async () => {
    const g = await pastGoal();
    await judge(g.id, 1, { investedHours: 1, costNote: 'x' }, { enforced: true }, NOW);
    const { router } = renderAt(`/judge/${g.id}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.goals.kizami }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/goals/${g.id}/kizami`));
  });

  it('届いた場合も同じ流れと同じ見た目で「判定を記録しました」と決めておいた次の行動を出す', async () => {
    const met = await pastGoal({ title: '届く段' });
    renderAt(`/judge/${met.id}`);
    fireEvent.change(await screen.findByTestId('judge-actual'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: ja.common.check }));
    expect(screen.getByTestId('judge-check-line')).toHaveTextContent('3章。3章 以上に 届いた');
    fireEvent.click(within(screen.getByTestId('check-sheet')).getByRole('button', { name: ja.common.confirm }));
    const done = await screen.findByTestId('judge-done');
    expect(done).toHaveTextContent('次の章の構成を作る');
    expect(screen.getByRole('status')).toHaveTextContent(ja.feedback.judgmentRecorded);
    expect(within(done).getByRole('button', { name: ja.goals.nextLevel })).toBeInTheDocument();
    expect((await db.goals.get(met.id))?.status).toBe('MET');
    const metClass = done.className;
    cleanup();

    const unmet = await pastGoal({ title: '届かない段' });
    await judge(unmet.id, 1, { investedHours: 1, costNote: 'x' }, { enforced: true }, NOW);
    renderAt(`/judge/${unmet.id}`);
    fireEvent.click(await screen.findByRole('button', { name: ja.goals.withdraw }));
    expect((await screen.findByTestId('judge-done')).className).toBe(metClass);
  });

  it('期限前の段は判定できない', async () => {
    const g = await createGoal(input({ deadline: '2026-10-25' }), NOW);
    renderAt(`/judge/${g.id}`);
    expect(await screen.findByTestId('judge-not-due')).toHaveTextContent(ja.errors.notDue);
  });
});

describe('判定待ちと足踏み', () => {
  it('ホームの道の先頭に判定ノードを出し、「判定する」で判定へ移る', async () => {
    const g = await pastGoal();
    await detectDueGoals('2026-10-18', NOW);
    const { router } = renderAt('/');
    const node = await screen.findByTestId(`judge-node-${g.id}`);
    expect(node).toHaveAttribute('data-state', 'next');
    expect(node).toHaveTextContent('期限 10/15(木) を過ぎました');
    fireEvent.click(within(node).getByRole('button', { name: ja.today.node.judge }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/judge/${g.id}`));
  });

  it('盤面に判定待ちと足踏みを出し、足踏みは却下できる', async () => {
    const due = await pastGoal({ title: '期限切れの段' });
    await detectDueGoals('2026-10-18', NOW);
    const open = await createGoal(input({ title: '延ばしている段', deadline: '2026-10-19' }), NOW);
    for (const [d, r] of [['2026-10-20', 'a'], ['2026-10-21', 'b'], ['2026-10-22', 'c']]) await extendDeadline(open.id, d, r, '2026-10-18', NOW);
    await syncStallFlags('2026-10-18', NOW);
    renderAt('/board');
    expect(await screen.findByTestId('pending-judgments')).toHaveTextContent('期限切れの段');
    const stalls = screen.getByTestId('stall-flags');
    expect(stalls).toHaveTextContent('期限を3回延ばしています');
    expect(stalls).toHaveTextContent('延ばしている段');
    fireEvent.click(within(stalls).getByRole('button', { name: ja.goals.stall.dismiss }));
    await waitFor(() => expect(screen.queryByTestId('stall-flags')).toBeNull());
    expect(await db.stallFlags.count()).toBe(1);
    expect(due.id).toBeTruthy();
  });
});

describe('段の詳細と木', () => {
  it('AC-GOAL-24: 深さ6以上の段に「最上位から{n}段下」が表示される', async () => {
    const chain: Goal[] = [];
    for (let i = 0; i <= 6; i++) {
      const g: Goal = {
        id: `g${i}`,
        parentId: i === 0 ? null : `g${i - 1}`,
        recutOfId: null,
        metricId,
        title: `段${i}`,
        targetValue: 1,
        comparator: 'GTE',
        deadline: '2026-11-01',
        status: i === 6 ? 'OPEN' : 'UNMET',
        createdAt: NOW + i,
        hiddenAt: null,
      };
      chain.push(g);
    }
    await db.goals.bulkAdd(chain);
    renderAt('/goals/g6');
    const tree = await screen.findByTestId('goal-tree');
    const rows = within(tree).getAllByRole('listitem');
    expect(rows).toHaveLength(7);
    expect(rows[6]).toHaveTextContent('最上位から6段下');
    expect(rows[5]).not.toHaveTextContent('段下');
    expect(screen.getByTestId('goal-detail')).toHaveTextContent('最上位から6段下');
  });

  it('届かなかった段の詳細に「刻む」「切り直す」、判定と訂正の履歴を出す', async () => {
    const g = await pastGoal();
    await judge(g.id, 1, { investedHours: 1, costNote: 'x' }, { enforced: true }, NOW);
    renderAt(`/goals/${g.id}`);
    expect(await screen.findByRole('button', { name: ja.goals.kizami })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ja.goals.recut })).toBeInTheDocument();
    expect(screen.getByTestId('goal-judgment')).toHaveTextContent('届かなかった（1章）');
    expect(screen.getByTestId('goal-status')).toHaveTextContent('届かなかった');
    // 最上位の段なので非表示のボタンはない
    expect(screen.queryByRole('button', { name: ja.goals.hide })).toBeNull();
  });
});

describe('判定の履歴', () => {
  it('全判定を新しい順に出し、絞り込みと訂正の追記ができる', async () => {
    const a = await pastGoal({ title: '届いた段' });
    const b = await pastGoal({ title: '届かなかった段' });
    await judge(a.id, 3, null, { enforced: true }, NOW - 1000);
    const jb = await judge(b.id, 1, { investedHours: 1, costNote: 'x' }, { enforced: true }, NOW);
    renderAt('/library/history');
    const list = await screen.findByTestId('judgment-history');
    expect(within(list).getAllByText(/段$/).map((e) => e.textContent)).toEqual(['届かなかった段', '届いた段']);
    fireEvent.click(screen.getByRole('radio', { name: ja.goals.met }));
    expect(screen.queryByText('届かなかった段')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: ja.goals.history.all }));
    const card = screen.getByTestId(`judgment-${jb.id}`);
    fireEvent.click(within(card).getByRole('button', { name: ja.goals.history.correctValue }));
    fireEvent.change(within(card).getByLabelText(ja.goals.history.newValue), { target: { value: '2' } });
    const save = within(card).getByRole('button', { name: ja.goals.history.save });
    expect(save).toBeDisabled();
    fireEvent.change(within(card).getByLabelText(ja.goals.reasonQ), { target: { value: '数え直した' } });
    fireEvent.click(save);
    await waitFor(async () => expect(await db.judgmentCorrections.count()).toBe(1));
    await waitFor(() => expect(screen.getByTestId(`judgment-${jb.id}`)).toHaveTextContent('（2章）'));
    expect((await db.judgments.get(jb.id))?.actualValue).toBe(1);
  });
});
