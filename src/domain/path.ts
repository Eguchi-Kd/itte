// きょうの道（§8.10）
// M1 では習慣のノードと「記録なしの理由」の割り込みだけを組み立てる。
// 判定・決めかけの手・やること・週次ふりかえり・1日のしめのノードは、各モジュールのタスクで PathInput と PathNode に足す
import { formatIntention } from './habits/formatIntention';
import { pendingReasonPrompts, type ReasonPrompt } from './habits/reasons';
import { isScheduled } from './habits/schedule';
import { weekCount } from './habits/stats';
import type { EpochMs, Habit, HabitLog, ID, LocalDate, Persona } from './types';

/** 道に効く機能フラグ（§9.2 の Flags の一部。実験ランナーは T30 で computeFlags から渡す） */
export interface PathFlags {
  judgmentEnforced: boolean;
  roughStart: boolean;
}

export const DEFAULT_PATH_FLAGS: PathFlags = { judgmentEnforced: true, roughStart: true };

export interface PathInput {
  today: LocalDate;
  persona: Persona | null;
  flags: PathFlags;
  habits: readonly Habit[];
  /** 少なくとも today-7〜today の記録 */
  habitLogs: readonly HabitLog[];
  /** 割り込みカード ID → 「あとで」を押した論理日 */
  dismissed: Record<string, LocalDate>;
}

export type PathNodeState = 'next' | 'todo' | 'done';
export type PathNodeKind = 'judge' | 'decide' | 'habit' | 'task' | 'weekly' | 'daily';

export interface HabitPathNode {
  id: string;
  kind: 'habit';
  state: PathNodeState;
  habitId: ID;
  name: string;
  intention: string;
  unit: string;
  /** 今日の記録（done=true）の量。記録がなければ null */
  recordedAmount: number | null;
  /** persona が optimist のときだけ「今週 {done}/{scheduled} 回」 */
  weekCount: { done: number; scheduled: number } | null;
}

export type PathNode = HabitPathNode;

export type InterruptCardId = 'resume' | 'reason' | 'carry' | 'integrity' | 'backup' | 'install';

export type InterruptCard = { id: 'reason'; prompts: ReasonPrompt[] };

/** §6.3.3 の優先順 */
export const INTERRUPT_PRIORITY: readonly InterruptCardId[] = ['resume', 'reason', 'carry', 'integrity', 'backup', 'install'];
export const MAX_INTERRUPTS = 2;

export interface TodayPath {
  interrupts: InterruptCard[];
  nodes: PathNode[];
  nextNodeId: string | null;
}

function habitOrder(a: Habit, b: Habit): number {
  const ta = a.schedule.time;
  const tb = b.schedule.time;
  if (ta && tb) return ta < tb ? -1 : ta > tb ? 1 : a.createdAt - b.createdAt;
  if (ta) return -1;
  if (tb) return 1;
  return a.createdAt - b.createdAt;
}

/** 今日が予定日の active な習慣（時刻つきを時刻順、続いて時刻なしを createdAt 順） */
export function todayHabits(habits: readonly Habit[], today: LocalDate): Habit[] {
  return habits.filter((h) => h.status === 'active' && isScheduled(h, today)).sort(habitOrder);
}

/** 今日は予定のない active な習慣（予定外の日の実行を記録できる） */
export function unscheduledHabits(habits: readonly Habit[], today: LocalDate): Habit[] {
  return habits
    .filter((h) => h.status === 'active' && h.startedOn <= today && !isScheduled(h, today))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function isDismissed(dismissed: Record<string, LocalDate>, id: InterruptCardId, today: LocalDate): boolean {
  return dismissed[id] === today;
}

export function buildTodayPath(input: PathInput, _now: EpochMs): TodayPath {
  const { today, habits, habitLogs, persona } = input;

  // 割り込みカード（§6.3.3）。M1 は 2: 記録なしの理由 だけ
  const candidates: InterruptCard[] = [];
  const prompts = pendingReasonPrompts(habits, habitLogs, today);
  if (prompts.length > 0 && !isDismissed(input.dismissed, 'reason', today)) candidates.push({ id: 'reason', prompts });
  const interrupts = candidates
    .sort((a, b) => INTERRUPT_PRIORITY.indexOf(a.id) - INTERRUPT_PRIORITY.indexOf(b.id))
    .slice(0, MAX_INTERRUPTS);

  // ノード（§8.10 の 3: 今日が予定日の active な習慣）
  const doneToday = new Map(habitLogs.filter((l) => l.date === today && l.done).map((l) => [l.habitId, l.amount]));
  const nodes: PathNode[] = todayHabits(habits, today).map((h) => ({
    id: `habit:${h.id}`,
    kind: 'habit',
    state: doneToday.has(h.id) ? 'done' : 'todo',
    habitId: h.id,
    name: h.name,
    intention: formatIntention(h),
    unit: h.unit,
    recordedAmount: doneToday.get(h.id) ?? null,
    weekCount: persona === 'optimist' ? weekCount(h, habitLogs, today) : null,
  }));

  const next = nodes.find((n) => n.state !== 'done') ?? null;
  if (next) next.state = 'next';
  return { interrupts, nodes, nextNodeId: next?.id ?? null };
}
