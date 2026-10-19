import { describe, expect, it } from 'vitest';
import { ja } from '../../copy/ja';
import { fill } from '../../copy/fill';
import { activeEvaluation, buildBoard, dueLabel, periodsOverlap } from '../board/board';
import type { BoardItem, EvaluationFunction, Goal } from '../types';

const TODAY = '2026-10-18';

function item(p: Partial<BoardItem>): BoardItem {
  return { id: 'i', type: 'deadline', title: 't', dueDate: null, status: 'open', source: 'manual', externalUid: null, createdAt: 0, ...p };
}
function goal(p: Partial<Goal>): Goal {
  return {
    id: 'g',
    parentId: null,
    recutOfId: null,
    metricId: 'm',
    title: '段',
    targetValue: 3,
    comparator: 'GTE',
    deadline: '2026-10-25',
    status: 'OPEN',
    createdAt: 0,
    hiddenAt: null,
    ...p,
  };
}
function ef(p: Partial<EvaluationFunction>): EvaluationFunction {
  return { id: 'e', metric: '週に書いた章数', avoid: [], startDate: '2026-10-01', endDate: '2026-12-31', createdAt: 0, ...p };
}

describe('buildBoard', () => {
  it('AC-BOARD-01: open の締切・予定と OPEN の段を期限の近い順に並べ、期限なしを末尾にする', () => {
    const items = [
      item({ id: 'none', title: '期限なし', dueDate: null, createdAt: 1 }),
      item({ id: 'ev', type: 'event', title: 'ゼミ', dueDate: '2026-10-20', createdAt: 2 }),
      item({ id: 'over', title: '提出', dueDate: '2026-10-16', createdAt: 3 }),
      item({ id: 'same2', title: '同じ日（後）', dueDate: '2026-10-22', createdAt: 9 }),
      item({ id: 'done', title: '済み', dueDate: '2026-10-19', status: 'done' }),
      item({ id: 'proj', type: 'project', title: '案件', createdAt: 5 }),
      item({ id: 'res', type: 'resource', title: '今月の残り 2万円', createdAt: 6 }),
    ];
    const goals = [
      goal({ id: 'g1', title: '章を3つ', deadline: '2026-10-22', createdAt: 4 }),
      goal({ id: 'met', status: 'MET', deadline: '2026-10-19' }),
      goal({ id: 'hidden', hiddenAt: 1, deadline: '2026-10-19' }),
    ];
    const b = buildBoard(items, goals, TODAY);
    expect(b.deadlines.map((r) => r.id)).toEqual(['over', 'ev', 'g1', 'same2', 'none']);
    expect(b.deadlines.map((r) => r.daysLeft)).toEqual([-2, 2, 4, 4, null]);
    expect(b.deadlines.map((r) => r.kind)).toEqual(['item', 'item', 'goal', 'item', 'item']);
    expect(b.projects.map((p) => p.id)).toEqual(['proj']);
    expect(b.resources.map((p) => p.id)).toEqual(['res']);
  });
});

describe('dueLabel', () => {
  it('AC-BOARD-02: 「あと{n}日」「今日」「{n}日超過」を返す', () => {
    expect(dueLabel(3)).toBe('あと3日');
    expect(dueLabel(1)).toBe('あと1日');
    expect(dueLabel(0)).toBe('今日');
    expect(dueLabel(-1)).toBe('1日超過');
    expect(dueLabel(-12)).toBe('12日超過');
  });

  it('文言辞書の board.days／today／over と同じ文になる', () => {
    expect(dueLabel(5)).toBe(fill(ja.board.days, { n: 5 }));
    expect(dueLabel(0)).toBe(ja.board.today);
    expect(dueLabel(-5)).toBe(fill(ja.board.over, { n: 5 }));
  });
});

describe('評価関数', () => {
  it('periodsOverlap は両端を含めて重なるか', () => {
    const a = { startDate: '2026-10-01', endDate: '2026-10-31' };
    expect(periodsOverlap(a, { startDate: '2026-10-31', endDate: '2026-11-30' })).toBe(true);
    expect(periodsOverlap(a, { startDate: '2026-11-01', endDate: '2026-11-30' })).toBe(false);
    expect(periodsOverlap(a, { startDate: '2026-09-01', endDate: '2026-10-01' })).toBe(true);
    expect(periodsOverlap(a, { startDate: '2026-10-10', endDate: '2026-10-12' })).toBe(true);
  });

  it('activeEvaluation は今日を含むもの', () => {
    expect(activeEvaluation([ef({ id: 'past', startDate: '2026-07-01', endDate: '2026-09-30' }), ef({ id: 'now' })], TODAY)?.id).toBe('now');
    expect(activeEvaluation([ef({ startDate: '2026-10-19', endDate: '2026-12-31' })], TODAY)).toBeNull();
  });
});
