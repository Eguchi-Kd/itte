// ガード（§8.2.3）
import { diffDays } from '../dates';
import type { Habit, HabitLog, LocalDate, Persona } from '../types';
import {
  LEVEL_UP_GROWTH,
  LEVEL_UP_MAX_FACTOR,
  LEVEL_UP_MIN_RATE,
  LEVEL_UP_MIN_SCHEDULED,
  LEVEL_UP_WINDOW_DAYS,
} from '../verify/thresholds';
import { recentRatio } from './stats';

export function smallStartFactor(persona: Persona | null): number {
  return persona === 'selfblame' ? 1.5 : 2;
}

/** amount > minAmount * k なら minAmount を返す。k は既定 2、selfblame なら 1.5 */
export function smallStartSuggestion(amount: number, minAmount: number, persona: Persona | null): number | null {
  return amount > minAmount * smallStartFactor(persona) ? minAmount : null;
}

/** 直近14日の rate >= 0.9、予定日 >= 4、量を変えてから14日以上のとき、新しい量を返す */
export function levelUpSuggestion(habit: Habit, logs: readonly HabitLog[], today: LocalDate): number | null {
  const r = recentRatio(habit, logs, today, LEVEL_UP_WINDOW_DAYS);
  if (r.rate === null || r.rate < LEVEL_UP_MIN_RATE) return null;
  if (r.scheduled < LEVEL_UP_MIN_SCHEDULED) return null;
  if (diffDays(today, habit.amountChangedOn) < LEVEL_UP_WINDOW_DAYS) return null;
  const a = habit.amount;
  // TODO(spec): 15-6 量を上げる提案の式は暫定（verify/thresholds.ts）
  return Math.min(a * LEVEL_UP_MAX_FACTOR, Math.max(a + 1, Math.ceil(a * LEVEL_UP_GROWTH)));
}
