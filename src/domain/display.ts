// 表示の補助（§8.12.5）
import { parseLocalDate } from './dates';
import type { EpochMs, LocalDate } from './types';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function weekdayLabel(day: number): string {
  return WEEKDAY_LABELS[((day % 7) + 7) % 7];
}

/** '2026-10-16' → '10/16(金)' */
export function formatDateShort(s: LocalDate): string {
  const d = parseLocalDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdayLabel(d.getDay())})`;
}

/** 372000 → '6:12'。負の値は 0:00 */
export function formatMmSs(ms: EpochMs): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** (55, '分') → '55分' */
export function formatAmount(amount: number, unit: string): string {
  return `${amount}${unit}`;
}

/** (4, 6) → '4/6 回' */
export function formatRatio(done: number, scheduled: number): string {
  return `${done}/${scheduled} 回`;
}
