// 実行意図の1文（§8.2.8）
// 形式: {曜日}の{時刻 or きっかけ}に、{場所}で、{やり方}{行動名}を{量}{単位}
import { weekdayLabel } from '../display';
import type { Habit } from '../types';

export type IntentionInput = Pick<
  Habit,
  'kind' | 'name' | 'replacesText' | 'unit' | 'amount' | 'schedule' | 'place' | 'how'
>;

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** 全曜日 → 毎日、月〜金 → 平日、土日 → 土日、それ以外は「月・水・金曜」 */
export function formatDays(days: readonly number[]): string {
  const set = new Set(days);
  if (set.size === 7) return '毎日';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return '平日';
  if (set.size === 2 && set.has(0) && set.has(6)) return '土日';
  return `${MONDAY_FIRST.filter((d) => set.has(d)).map(weekdayLabel).join('・')}曜`;
}

/** '07:00' → '7:00' */
export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  return `${Number(h)}:${m}`;
}

export function formatIntention(h: IntentionInput): string {
  const when = h.schedule.time ? formatTime(h.schedule.time) : (h.schedule.cue ?? '');
  const prefix = h.kind === 'replace' && h.replacesText ? `${h.replacesText}の代わりに、` : '';
  return `${prefix}${formatDays(h.schedule.days)}の${when}に、${h.place}で、${h.how}${h.name}を${h.amount}${h.unit}`;
}
