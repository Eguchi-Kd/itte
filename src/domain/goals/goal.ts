// 段の検証（§8.7.1）【刻】。zod で、期限・決めておくこと・予想のどれかが欠けた段を作れないようにする
import { z } from 'zod';
import type { Comparator, Direction, ID, LocalDate } from '../types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const metricInputSchema = z.object({
  name: text(1, 40),
  unit: text(1, 10),
  direction: z.enum(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER']),
  // 取得方法が空なら登録しない
  collectionMethod: text(1, 200),
  verifiable: z.boolean(),
});
export type MetricInput = z.infer<typeof metricInputSchema>;

export interface GoalInput {
  metricId: ID;
  title: string;
  targetValue: number;
  comparator: Comparator;
  deadline: LocalDate;
  onMet: string;
  onUnmet: string;
  probability: number;
  predictedValue: number;
}

/** 期限は today より後（I1、D41）。ON_MET と ON_UNMET（I4）と OUTCOME 予想が必須 */
export function goalInputSchema(today: LocalDate) {
  return z.object({
    metricId: z.string().min(1),
    title: text(1, 80),
    targetValue: z.number().finite(),
    comparator: z.enum(['GTE', 'LTE']),
    deadline: z
      .string()
      .regex(DATE_RE)
      .refine((d) => d > today, { message: 'deadlineFuture' }),
    onMet: text(1, 80),
    onUnmet: text(1, 80),
    probability: z.number().finite().min(0).max(100),
    predictedValue: z.number().finite(),
  });
}

export type GoalField = keyof GoalInput;

/** 検証に通らない項目の一覧（空なら有効） */
export function goalInputErrors(input: Partial<GoalInput>, today: LocalDate): GoalField[] {
  const r = goalInputSchema(today).safeParse(input);
  if (r.success) return [];
  return [...new Set(r.error.issues.map((i) => i.path[0] as GoalField))];
}

/** 期限のエラーの文言キー（§6.8.1 の期限は明日以降） */
export function goalErrorCopyKey(fields: readonly GoalField[]): string {
  if (fields.includes('deadline')) return 'errors.deadlineFuture';
  if (fields.includes('onMet') || fields.includes('onUnmet')) return 'errors.commitments';
  return 'errors.required';
}

/** 向きから既定の比較を選ぶ */
export function defaultComparator(direction: Direction): Comparator {
  return direction === 'HIGHER_IS_BETTER' ? 'GTE' : 'LTE';
}
