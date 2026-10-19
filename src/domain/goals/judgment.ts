// 判定（§8.7.4）【刻】。結果は computeOutcome で計算し、UI から受け取らない
import type { Comparator, Judgment, JudgmentCorrection, JudgmentOutcome } from '../types';

export function computeOutcome(c: Comparator, target: number, actual: number): JudgmentOutcome {
  return (c === 'GTE' ? actual >= target : actual <= target) ? 'MET' : 'UNMET';
}

type CorrectableField = JudgmentCorrection['field'];
type FieldValue<F extends CorrectableField> = F extends 'costNote' ? string | null : number | null;

/** 最も新しい訂正があればその値、なければ元の値 */
export function effectiveValue<F extends CorrectableField>(
  j: Judgment,
  corrections: readonly JudgmentCorrection[],
  field: F,
): FieldValue<F> {
  const latest = corrections
    .filter((c) => c.judgmentId === j.id && c.field === field)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  return (latest ? latest.newValue : j[field]) as FieldValue<F>;
}

export const judgmentDelayMs = (j: Pick<Judgment, 'judgedAt' | 'requestedAt'>) => j.judgedAt - j.requestedAt;

export interface UnmetDetail {
  investedHours: number | null;
  costNote: string | null;
}

/** 届かなかった判定では、かけた時間（0以上の数）と失ったもの（1〜200文字）が必須（AC-GOAL-11） */
export function unmetDetailValid(d: UnmetDetail | null): boolean {
  if (!d) return false;
  const hours = d.investedHours;
  const note = (d.costNote ?? '').trim();
  return hours !== null && Number.isFinite(hours) && hours >= 0 && note.length >= 1 && note.length <= 200;
}
