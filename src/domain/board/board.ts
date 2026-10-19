// 盤面（§8.5）【盤】
import { diffDays } from '../dates';
import type { BoardItem, EvaluationFunction, Goal, ID, LocalDate } from '../types';

/** startDate <= today <= endDate の評価関数（最大1件） */
export function activeEvaluation(efs: readonly EvaluationFunction[], today: LocalDate): EvaluationFunction | null {
  return efs.find((e) => e.startDate <= today && today <= e.endDate) ?? null;
}

/** 両端を含めて重なるか（I10） */
export function periodsOverlap(
  a: Pick<EvaluationFunction, 'startDate' | 'endDate'>,
  b: Pick<EvaluationFunction, 'startDate' | 'endDate'>,
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export interface DeadlineRow {
  kind: 'item' | 'goal';
  id: ID;
  title: string;
  dueDate: LocalDate | null;
  daysLeft: number | null;
  createdAt: number;
  /** kind='item' のときの元の項目 */
  item?: BoardItem;
}

export interface Board {
  deadlines: DeadlineRow[];
  projects: BoardItem[];
  resources: BoardItem[];
}

/**
 * 期限リスト: status='open' で type ∈ {deadline, event} の項目と、OPEN かつ非表示でない段を合成する（D17）。
 * dueDate の昇順、期限なしは末尾、同じ日付は createdAt 順
 */
export function buildBoard(items: readonly BoardItem[], goals: readonly Goal[], today: LocalDate): Board {
  const open = items.filter((i) => i.status === 'open');
  const rows: DeadlineRow[] = [
    ...open
      .filter((i) => i.type === 'deadline' || i.type === 'event')
      .map((i) => ({
        kind: 'item' as const,
        id: i.id,
        title: i.title,
        dueDate: i.dueDate,
        daysLeft: i.dueDate ? diffDays(i.dueDate, today) : null,
        createdAt: i.createdAt,
        item: i,
      })),
    ...goals
      .filter((g) => g.status === 'OPEN' && g.hiddenAt === null)
      .map((g) => ({
        kind: 'goal' as const,
        id: g.id,
        title: g.title,
        dueDate: g.deadline,
        daysLeft: diffDays(g.deadline, today),
        createdAt: g.createdAt,
      })),
  ];
  rows.sort((a, b) => {
    if (a.dueDate === b.dueDate) return a.createdAt - b.createdAt;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  });
  const byCreated = (a: BoardItem, b: BoardItem) => a.createdAt - b.createdAt;
  return {
    deadlines: rows,
    projects: open.filter((i) => i.type === 'project').sort(byCreated),
    resources: open.filter((i) => i.type === 'resource').sort(byCreated),
  };
}

/** > 0 →「あと{n}日」、0 →「今日」、< 0 →「{n}日超過」（文言は copy の board.days／today／over と同じ） */
export function dueLabel(daysLeft: number): string {
  if (daysLeft > 0) return `あと${daysLeft}日`;
  if (daysLeft === 0) return '今日';
  return `${-daysLeft}日超過`;
}

export const MAX_ACTIVE_TRIGGERS = 5;
export const MAX_AVOID = 3;
