// 感情予想の開始前シートを出すか（§6.6.3、D36）【刻】
import { logicalDate } from '../dates';
import type { Goal, LocalDate, Prediction, Task } from '../types';

export interface AffectSheetInput {
  task: Pick<Task, 'goalId'>;
  goal: Pick<Goal, 'id' | 'status' | 'deadline'> | null;
  /** その段に判定があるか */
  judged: boolean;
  predictions: readonly Pick<Prediction, 'goalId' | 'kind' | 'predictedAt'>[];
  /** その段について今日すでにシートを出した（とばした場合を含む） */
  shownToday: boolean;
  /** 着手プリセットの A 条件では出さない */
  roughStart: boolean;
  today: LocalDate;
}

/**
 * やることが段に紐づいていて、その段の感情予想が今日まだなく、今日まだシートを出しておらず、
 * 予想を足せる段（OPEN・判定なし・期限内、I5）で、A 条件中でないとき true
 */
export function shouldAskAffect(i: AffectSheetInput): boolean {
  if (!i.roughStart || !i.task.goalId || !i.goal || i.goal.id !== i.task.goalId) return false;
  if (i.goal.status !== 'OPEN' || i.judged || i.today > i.goal.deadline) return false;
  if (i.shownToday) return false;
  return !i.predictions.some((p) => p.goalId === i.goal?.id && p.kind === 'AFFECT' && logicalDate(p.predictedAt) === i.today);
}

/** Settings.dismissed に記録するキー（その段のシートを今日出した） */
export const affectShownKey = (goalId: string) => `affect:${goalId}`;

export const AFFECT_DURATIONS = [1, 5, 10, 30, 60] as const;
export const AFFECT_INTENSITIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
