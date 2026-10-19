// 手（§8.5）【盤】
import { addDays, inRange, logicalDate } from '../dates';
import type { BlindSpot, Candidate, LocalDate, Move, MoveReview } from '../types';

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

export const BLIND_SPOTS: readonly BlindSpot[] = ['board', 'eval', 'trigger', 'reading'];

export interface BlindSpotStats {
  total: number;
  bad: number;
  badRate: number | null;
  byBlindSpot: Record<BlindSpot, number>;
}

/** 期間内（論理日、両端を含む）に作られ、感想戦をした手の悪手の割合と見落とし別の件数 */
export function blindSpotStats(
  moves: readonly Move[],
  reviews: readonly MoveReview[],
  from: LocalDate,
  to: LocalDate,
): BlindSpotStats {
  const inPeriod = new Set(moves.filter((m) => inRange(logicalDate(m.createdAt), from, to)).map((m) => m.id));
  const rs = reviews.filter((r) => inPeriod.has(r.moveId));
  const byBlindSpot: Record<BlindSpot, number> = { board: 0, eval: 0, trigger: 0, reading: 0 };
  let bad = 0;
  for (const r of rs) {
    if (r.rating !== 'bad') continue;
    bad += 1;
    if (r.blindSpot) byBlindSpot[r.blindSpot] += 1;
  }
  return { total: rs.length, bad, badRate: rs.length === 0 ? null : bad / rs.length, byBlindSpot };
}

/** 最多の見落とし。0件、または同数1位が複数なら null */
export function bottleneck(byBlindSpot: Record<BlindSpot, number>): BlindSpot | null {
  const max = Math.max(...BLIND_SPOTS.map((b) => byBlindSpot[b]));
  if (max === 0) return null;
  const top = BLIND_SPOTS.filter((b) => byBlindSpot[b] === max);
  return top.length === 1 ? top[0] : null;
}

/** 感想戦の入力の検証（I13）。悪手なら見落としが必須 */
export function moveReviewValid(r: Pick<MoveReview, 'rating' | 'blindSpot'> & { judgmentOk: boolean | null }): boolean {
  if (r.judgmentOk === null) return false;
  return r.rating !== 'bad' || r.blindSpot !== null;
}
