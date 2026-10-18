// 傾向（§8.2.5）
import { addDays, weekdayOf } from '../dates';
import { weekdayLabel } from '../display';
import type { Habit, HabitLog, ID, LocalDate } from '../types';
import { PATTERN_MAX, PATTERN_MIN_DIFF, PATTERN_MIN_N, PATTERN_ONLY_LOWER } from '../verify/thresholds';
import { scheduledDates } from './schedule';

export interface Pattern {
  key: string; // 'weekday:N' | 'prevMissed'
  label: string;
  rate: number;
  n: number;
  overall: number;
}

// 浮動小数の誤差で 0.20 ちょうどの差を落とさないための許容幅
const EPS = 1e-9;
const PREV_MISSED_LABEL = '前の予定日が記録なしだった日';

export function conditionLabel(key: string): string {
  if (key === 'prevMissed') return PREV_MISSED_LABEL;
  const m = /^weekday:(\d)$/.exec(key);
  return m ? `${weekdayLabel(Number(m[1]))}曜日` : key;
}

export function detectPatterns(habit: Habit, logs: readonly HabitLog[], today: LocalDate): Pattern[] {
  const days = scheduledDates(habit, habit.startedOn, addDays(today, -1));
  if (days.length === 0) return [];
  const doneDates = new Set(logs.filter((l) => l.habitId === habit.id && l.done).map((l) => l.date));
  const isDone = (d: LocalDate) => doneDates.has(d);
  const overall = days.filter(isDone).length / days.length;

  const groups = new Map<string, LocalDate[]>();
  const push = (key: string, d: LocalDate) => groups.set(key, [...(groups.get(key) ?? []), d]);
  days.forEach((d, i) => {
    push(`weekday:${weekdayOf(d)}`, d);
    if (i > 0 && !isDone(days[i - 1])) push('prevMissed', d);
  });

  const out: Pattern[] = [];
  for (const [key, ds] of groups) {
    const n = ds.length;
    if (n < PATTERN_MIN_N) continue;
    const rate = ds.filter(isDone).length / n;
    const diff = overall - rate;
    // TODO(spec): 15-6 全体より低い条件だけを返す（PATTERN_ONLY_LOWER）
    const gap = PATTERN_ONLY_LOWER ? diff : Math.abs(diff);
    if (gap + EPS < PATTERN_MIN_DIFF) continue;
    out.push({ key, label: conditionLabel(key), rate, n, overall });
  }
  return out.sort((a, b) => Math.abs(b.overall - b.rate) - Math.abs(a.overall - a.rate)).slice(0, PATTERN_MAX);
}

/** 記録なしの日の理由タグ別の件数（降順） */
export function reasonBreakdown(
  habit: Pick<Habit, 'id'>,
  logs: readonly HabitLog[],
  today: LocalDate,
): { tagId: ID; count: number }[] {
  const counts = new Map<ID, number>();
  for (const l of logs) {
    if (l.habitId !== habit.id || l.done || l.date > today) continue;
    for (const t of l.reasonTagIds) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts].map(([tagId, count]) => ({ tagId, count })).sort((a, b) => b.count - a.count);
}
