// 期限到来の検出（§8.7.3、D33）【刻】
import { addDays, dayStart } from '../dates';
import type { EpochMs, Goal, JudgmentRequest, LocalDate } from '../types';

/**
 * status='OPEN' かつ deadline < today かつ JudgmentRequest がない段について、作るべき JudgmentRequest を返す。
 * requestedAt は期限日が終わる瞬間（期限日の翌日の4:00）、detectedAt は now
 */
export function dueGoals(
  goals: readonly Goal[],
  requests: readonly JudgmentRequest[],
  today: LocalDate,
  now: EpochMs,
): JudgmentRequest[] {
  const requested = new Set(requests.map((r) => r.goalId));
  return goals
    .filter((g) => g.status === 'OPEN' && g.deadline < today && !requested.has(g.id))
    .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : a.createdAt - b.createdAt))
    .map((g) => ({ goalId: g.id, requestedAt: dayStart(addDays(g.deadline, 1)), detectedAt: now }));
}

/** 判定待ち: OPEN かつ JudgmentRequest がある段（期限の古い順） */
export function pendingJudgments(goals: readonly Goal[], requests: readonly JudgmentRequest[]): Goal[] {
  const requested = new Set(requests.map((r) => r.goalId));
  return goals
    .filter((g) => g.status === 'OPEN' && requested.has(g.id))
    .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : a.createdAt - b.createdAt));
}
