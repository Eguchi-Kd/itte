import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { createGoal, judge, saveMetric } from '../../db/repo/goals';
import { dayStart } from '../../domain/dates';
import type { GoalInput } from '../../domain/goals/goal';
import { CalibrationChart } from '../components/CalibrationChart';
import { NOW, renderAt, resetDb } from './testUtils';

let metricId = '';
function input(p: Partial<GoalInput> = {}): GoalInput {
  return {
    metricId,
    title: '章',
    targetValue: 4,
    comparator: 'GTE',
    deadline: '2026-10-15',
    onMet: 'a',
    onUnmet: 'b',
    probability: 60,
    predictedValue: 4,
    ...p,
  };
}

function yOf(el: Element): number {
  return Number(el.getAttribute('cy') ?? el.getAttribute('y1'));
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

describe('較正グラフ', () => {
  it('AC-GOAL-16: 過大評価（正）と過小評価（負）がゼロ線の反対側に描かれ、上下に「予想が高め」「予想が低め」がある', () => {
    render(<CalibrationChart values={[0.5, -0.4, 0]} label={ja.goals.calib.chart} />);
    const chart = screen.getByTestId('calibration-chart');
    const zero = yOf(within(chart).getByTestId('zero-line'));
    const [over, under, even] = within(chart).getAllByTestId('calibration-point').map(yOf);
    expect(over).toBeLessThan(zero);
    expect(under).toBeGreaterThan(zero);
    expect(even).toBe(zero);
    expect(chart).toHaveTextContent(ja.goals.calib.over);
    expect(chart).toHaveTextContent(ja.goals.calib.under);
    const texts = chart.querySelectorAll('text');
    expect(Number(texts[0].getAttribute('y'))).toBeLessThan(zero);
    expect(Number(texts[1].getAttribute('y'))).toBeGreaterThan(zero);
  });
});

describe('較正の画面', () => {
  it('AC-GOAL-16: 判定ごとの誤差を、予想が高めならゼロ線の上、低めなら下に描く。予想のない判定は除外する', async () => {
    // 予想4 → 実測2（高め）、予想4 → 実測6（低め）
    const over = await createGoal(input({ predictedValue: 4 }), dayStart('2026-10-01'));
    const under = await createGoal(input({ predictedValue: 4 }), dayStart('2026-10-02'));
    await judge(over.id, 2, { investedHours: 1, costNote: 'x' }, { enforced: true }, NOW - 2000);
    await judge(under.id, 6, null, { enforced: true }, NOW - 1000);
    renderAt('/review/calibration');
    const chart = await screen.findByTestId('calibration-chart');
    const zero = yOf(within(chart).getByTestId('zero-line'));
    const points = within(chart).getAllByTestId('calibration-point');
    expect(points.map((p) => Number(p.getAttribute('data-value')))).toEqual([0.5, -0.5]);
    expect(yOf(points[0])).toBeLessThan(zero);
    expect(yOf(points[1])).toBeGreaterThan(zero);
    expect(screen.getByTestId('calibration-error')).toHaveTextContent('0.00');
    expect(screen.getByTestId('calibration')).toHaveTextContent(ja.goals.calib.meaning);
  });

  it('AC-GOAL-21: 較正画面に判定遅延の中央値が表示される', async () => {
    // 期限 10/15 → requestedAt は 10/16 04:00。判定 10/18 12:00 → 56時間
    const g = await createGoal(input(), dayStart('2026-10-01'));
    await judge(g.id, 5, null, { enforced: true }, NOW);
    renderAt('/review/calibration');
    expect(await screen.findByTestId('calibration-delay')).toHaveTextContent('判定までの時間の中央値 56時間');
    expect(screen.getByTestId('calibration-prob')).toHaveTextContent('予想した確率の平均 60%／実際に届いた割合 100%（1件）');
  });

  it('予想と判定がそろった段がなければ、その旨とコマを出す', async () => {
    renderAt('/review/calibration');
    expect(await screen.findByText(ja.goals.calib.empty)).toBeInTheDocument();
    expect(screen.getByTestId('calibration-delay')).toHaveTextContent('判定までの時間の中央値 —時間');
  });
});
