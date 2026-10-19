import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { taskInput, testDb as db } from '../../db/__tests__/helpers';
import { createTask, startSession } from '../../db/repo/start';
import { NOW, renderAt, resetDb } from './testUtils';

const DAY = 86_400_000;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const cell = (label: string) => screen.getByTestId(`metric-${label}`);

describe('数字の画面', () => {
  it('AC-REV-04: データ不足の指標が「—（{n}件）」と表示される', async () => {
    // 今週のやることは2組だけ（最小の3組に満たない）
    const a = await createTask(taskInput({ title: 'A', plannedFor: '2026-10-13' }), true, NOW - 5 * DAY);
    await createTask(taskInput({ title: 'B', plannedFor: '2026-10-14' }), true, NOW - 4 * DAY);
    await startSession(a.id, true, null, new Date(2026, 9, 13, 10).getTime());
    renderAt('/review/numbers');
    await screen.findByTestId('numbers');
    expect(screen.getByTestId('numbers-week')).toHaveTextContent('10/12(月)の週');
    expect(cell(ja.review.numbersScreen.startRate)).toHaveTextContent('—（2件）');
    expect(cell(ja.review.numbersScreen.stuckContinue)).toHaveTextContent('—（0件）');
    expect(cell(ja.review.numbersScreen.driftWorry)).toHaveTextContent('—（0件）');
    expect(cell(ja.review.numbersScreen.delay)).toHaveTextContent('—（0件）');
  });

  it('AC-REV-04: 件数がそろえば数値を、評価語なしで出す。週を切り替えられる', async () => {
    for (const [i, d] of ['2026-10-13', '2026-10-14', '2026-10-15'].entries()) {
      const t = await createTask(taskInput({ title: `T${i}`, plannedFor: d }), true, NOW - 6 * DAY);
      if (i < 2) await startSession(t.id, true, null, new Date(`${d}T10:00:00`).getTime());
    }
    for (const [i, m] of [30, 60, 120].entries()) {
      await db.dailyChecks.put({ date: `2026-10-1${3 + i}`, pendingWorry: true, consumptionMin: m, plannedTaskExists: true, answeredAt: NOW });
    }
    renderAt('/review/numbers');
    await screen.findByTestId('numbers');
    expect(cell(ja.review.numbersScreen.startRate)).toHaveTextContent('67%（2/3）');
    expect(cell(ja.review.numbersScreen.driftWorry)).toHaveTextContent('60分（3日）');
    const text = screen.getByTestId('numbers').textContent ?? '';
    for (const w of ['よい', '悪い', 'すごい', '残念']) expect(text).not.toContain(w);
    fireEvent.click(screen.getByRole('button', { name: ja.review.numbersScreen.prev }));
    expect(screen.getByTestId('numbers-week')).toHaveTextContent('10/5(月)の週');
    expect(cell(ja.review.numbersScreen.startRate)).toHaveTextContent('—（0件）');
    expect(within(screen.getByRole('region', { name: ja.review.numbersScreen.escapes })).getAllByRole('row')).toHaveLength(5);
  });
});
