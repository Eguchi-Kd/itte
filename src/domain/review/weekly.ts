// 週次ふりかえり（§8.6、§6.9、D20・D21）【統】
import { movesInWeek } from '../board/moves';
import { addDays, inRange, logicalDate, weekdayOf } from '../dates';
import { graduationEligible } from '../habits/automaticity';
import { detectPatterns, type Pattern } from '../habits/patterns';
import { reviewDue } from '../habits/review';
import { scheduledDates } from '../habits/schedule';
import type {
  EscapeLog,
  Habit,
  HabitLog,
  ID,
  Judgment,
  LocalDate,
  Move,
  Persona,
  Session,
  StallFlag,
  StuckLog,
  WeeklyCheck,
} from '../types';

/** 金・土・日ならその週の weekStart、月ならその前の週の weekStart、それ以外は null（D21） */
export function reviewTargetWeek(today: LocalDate): LocalDate | null {
  const wd = weekdayOf(today);
  if (wd === 5) return addDays(today, -4);
  if (wd === 6) return addDays(today, -5);
  if (wd === 0) return addDays(today, -6);
  if (wd === 1) return addDays(today, -7);
  return null;
}

export interface WeeklyInput {
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  checks: readonly WeeklyCheck[];
  sessions: readonly Session[];
  stuckLogs: readonly StuckLog[];
  escapeLogs: readonly EscapeLog[];
  moves: readonly Move[];
  judgments: readonly Judgment[];
  /** 却下されていない足踏み */
  stallFlags: readonly StallFlag[];
  persona: Persona | null;
}

export interface WeeklyFacts {
  habits: { habitId: ID; name: string; done: number; scheduled: number }[];
  sessions: number;
  stucks: number;
  moves: number;
  judgments: number;
  escapes: number;
}

const inWeek = (ms: number, weekStart: LocalDate) => inRange(logicalDate(ms), weekStart, addDays(weekStart, 6));

/** 習慣チェックの対象: active で startedOn <= weekStart+6 */
export function weeklyHabits(habits: readonly Habit[], weekStart: LocalDate): Habit[] {
  return habits.filter((h) => h.status === 'active' && h.startedOn <= addDays(weekStart, 6)).sort((a, b) => a.createdAt - b.createdAt);
}

/** 数字カードの中身。評価語は付けない */
export function weeklyFacts(input: WeeklyInput, weekStart: LocalDate): WeeklyFacts {
  const end = addDays(weekStart, 6);
  return {
    habits: weeklyHabits(input.habits, weekStart).map((h) => {
      const dates = scheduledDates(h, weekStart, end);
      const done = new Set(input.habitLogs.filter((l) => l.habitId === h.id && l.done).map((l) => l.date));
      return { habitId: h.id, name: h.name, done: dates.filter((d) => done.has(d)).length, scheduled: dates.length };
    }),
    sessions: input.sessions.filter((s) => inWeek(s.startedAt, weekStart)).length,
    stucks: input.stuckLogs.filter((s) => inWeek(s.at, weekStart)).length,
    moves: movesInWeek(input.moves, weekStart).length,
    judgments: input.judgments.filter((j) => inWeek(j.judgedAt, weekStart)).length,
    escapes: input.escapeLogs.filter((e) => inWeek(e.at, weekStart)).length,
  };
}

export type WeeklySection = 'facts' | 'moves' | 'habits' | 'patterns' | 'stalls' | 'close';

export type WeeklyCard =
  | { key: 'facts'; section: 'facts' }
  | { key: string; section: 'moves'; moveId: ID }
  | { key: string; section: 'habits'; habitId: ID; reviewDue: boolean; graduationEligible: boolean }
  | { key: string; section: 'patterns'; habitId: ID; patterns: Pattern[] }
  | { key: string; section: 'stalls'; flagId: ID }
  | { key: 'close'; section: 'close' };

/** §6.9 の区画順にカードを並べ、対象のない区画は省く。各カードは安定した key を持つ */
export function buildWeeklyCards(input: WeeklyInput, weekStart: LocalDate, today: LocalDate): WeeklyCard[] {
  const cards: WeeklyCard[] = [{ key: 'facts', section: 'facts' }];
  for (const m of movesInWeek(input.moves, weekStart).sort((a, b) => a.createdAt - b.createdAt)) {
    cards.push({ key: `move:${m.id}`, section: 'moves', moveId: m.id });
  }
  const habits = weeklyHabits(input.habits, weekStart);
  for (const h of habits) {
    cards.push({
      key: `habit:${h.id}`,
      section: 'habits',
      habitId: h.id,
      reviewDue: reviewDue(h, input.checks, today, input.persona),
      graduationEligible: graduationEligible(h, input.habitLogs, input.checks, today),
    });
  }
  for (const h of habits) {
    const patterns = detectPatterns(h, input.habitLogs, today);
    if (patterns.length > 0) cards.push({ key: `pattern:${h.id}`, section: 'patterns', habitId: h.id, patterns });
  }
  for (const f of input.stallFlags.filter((x) => x.dismissedAt === null)) {
    cards.push({ key: `stall:${f.id}`, section: 'stalls', flagId: f.id });
  }
  cards.push({ key: 'close', section: 'close' });
  return cards;
}

/** その週が月の最初の週か（週の月曜が1〜7日）。しめのカードで評価関数の見直しを出す */
export function isFirstWeekOfMonth(weekStart: LocalDate): boolean {
  return Number(weekStart.slice(8, 10)) <= 7;
}
