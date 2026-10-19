// 手（§8.5）【盤】。感想戦の集計（blindSpotStats・bottleneck）は週次ふりかえり（T28）で足す
import { addDays, inRange, logicalDate } from '../dates';
import type { Candidate, LocalDate, Move } from '../types';

export type CandidateInput = Pick<Candidate, 'description' | 'plus1' | 'plus2' | 'score'>;

export const MIN_CANDIDATES = 2;
export const MAX_CANDIDATES = 3;

/** 候補は 2〜3件、description は 1〜200文字（I11） */
export function validateCandidates(cands: readonly CandidateInput[]): boolean {
  if (cands.length < MIN_CANDIDATES || cands.length > MAX_CANDIDATES) return false;
  return cands.every((c) => {
    const len = c.description.trim().length;
    return len >= 1 && len <= 200;
  });
}

/** 埋まっている候補（description が空でないもの）だけを残す */
export function filledCandidates(cands: readonly CandidateInput[]): CandidateInput[] {
  return cands.filter((c) => c.description.trim().length > 0);
}

/** mode='full' かつ未決定で、作成日が today-6 以降の手（作成の古い順） */
export function undecidedMoves(moves: readonly Move[], today: LocalDate): Move[] {
  const from = addDays(today, -6);
  return moves
    .filter((m) => m.mode === 'full' && m.decidedAt === null && logicalDate(m.createdAt) >= from)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** logicalDate(createdAt) が weekStart〜weekStart+6 の手 */
export function movesInWeek(moves: readonly Move[], weekStart: LocalDate): Move[] {
  const end = addDays(weekStart, 6);
  return moves.filter((m) => inRange(logicalDate(m.createdAt), weekStart, end));
}
