// きょうの道（§8.10）
// 判定・決めかけの手・週次ふりかえり・1日のしめのノードは、各モジュールのタスクで PathInput と PathNode に足す
import { undecidedMoves } from './board/moves';
import { pendingJudgments } from './goals/deadlines';
import { formatIntention } from './habits/formatIntention';
import { reviewTargetWeek } from './review/weekly';
import { pendingReasonPrompts, type ReasonPrompt } from './habits/reasons';
import { isScheduled } from './habits/schedule';
import { weekCount } from './habits/stats';
import { activeSession } from './start/session';
import { carryOverCandidates, startedOn, todayTask } from './start/tasks';
import type {
  Candidate,
  EpochMs,
  Goal,
  Habit,
  HabitLog,
  ID,
  JudgmentRequest,
  LocalDate,
  Move,
  Persona,
  Session,
  Task,
  WeeklyReviewRun,
} from './types';

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
  /** 未片づけのやること（予定日が今日以前のもの） */
  tasks: readonly Task[];
  /** 少なくとも今日始まったセッションと、終わっていないセッション */
  sessions: readonly Session[];
  /** 段と判定待ち（JudgmentRequest） */
  goals: readonly Goal[];
  judgmentRequests: readonly JudgmentRequest[];
  /** 少なくとも作成から7日以内の手 */
  moves: readonly Move[];
  /** moves の候補 */
  candidates: readonly Candidate[];
  /** 週次ふりかえりの実施記録 */
  weeklyRuns: readonly WeeklyReviewRun[];
  /** 着手モジュールを使ったことがある（やることかセッションが1件以上） */
  startUsed: boolean;
  /** 今日の 1日のしめ（DailyCheck）がある */
  dailyDone: boolean;
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

export interface TaskPathNode {
  id: string;
  kind: 'task';
  state: PathNodeState;
  taskId: ID;
  /** 次の一手（なければタイトル）。実験の A 条件ではタイトル */
  label: string;
  title: string;
}

export interface JudgePathNode {
  id: string;
  kind: 'judge';
  state: PathNodeState;
  goalId: ID;
  title: string;
  deadline: LocalDate;
}

export interface DecidePathNode {
  id: string;
  kind: 'decide';
  state: PathNodeState;
  moveId: ID;
  situation: string;
  candidates: { id: ID; description: string }[];
}

export interface WeeklyPathNode {
  id: 'weekly';
  kind: 'weekly';
  state: PathNodeState;
  weekStart: LocalDate;
}

export interface DailyPathNode {
  id: 'daily';
  kind: 'daily';
  state: PathNodeState;
}

export type PathNode = JudgePathNode | DecidePathNode | HabitPathNode | TaskPathNode | WeeklyPathNode | DailyPathNode;

export type InterruptCardId = 'resume' | 'reason' | 'carry' | 'integrity' | 'backup' | 'install';

export type InterruptCard =
  | { id: 'resume'; sessionId: ID; startedAt: EpochMs; remainingMs: number }
  | { id: 'reason'; prompts: ReasonPrompt[] }
  | { id: 'carry'; tasks: Task[] };

/** §6.3.3 の優先順 */
export const INTERRUPT_PRIORITY: readonly InterruptCardId[] = ['resume', 'reason', 'carry', 'integrity', 'backup', 'install'];
export const MAX_INTERRUPTS = 2;

export interface TodayPath {
  interrupts: InterruptCard[];
  nodes: PathNode[];
  nextNodeId: string | null;
  /** 今日のやることの2件目以降（「他のやること {n}件」に折りたたむ） */
  otherTasks: Task[];
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

export function buildTodayPath(input: PathInput, now: EpochMs): TodayPath {
  const { today, habits, habitLogs, persona, tasks, sessions, flags } = input;

  // 割り込みカード（§6.3.3）
  const candidates: InterruptCard[] = [];
  const running = activeSession(sessions, now);
  if (running) {
    candidates.push({
      id: 'resume',
      sessionId: running.id,
      startedAt: running.startedAt,
      remainingMs: running.startedAt + 10 * 60_000 - now,
    });
  }
  const prompts = pendingReasonPrompts(habits, habitLogs, today);
  if (prompts.length > 0 && !isDismissed(input.dismissed, 'reason', today)) candidates.push({ id: 'reason', prompts });
  const carry = carryOverCandidates(tasks, today);
  if (carry.length > 0 && !isDismissed(input.dismissed, 'carry', today)) candidates.push({ id: 'carry', tasks: carry });
  const interrupts = candidates
    .sort((a, b) => INTERRUPT_PRIORITY.indexOf(a.id) - INTERRUPT_PRIORITY.indexOf(b.id))
    .slice(0, MAX_INTERRUPTS);

  const nodes: PathNode[] = [];

  // 1: 判定（判定待ちの段を期限の古い順）。判定の強制が切られている期間（実験の A 条件）は出さない
  if (flags.judgmentEnforced) {
    for (const g of pendingJudgments(input.goals, input.judgmentRequests)) {
      nodes.push({ id: `judge:${g.id}`, kind: 'judge', state: 'todo', goalId: g.id, title: g.title, deadline: g.deadline });
    }
  }

  // 2: 決めかけの手（作成の古い順）
  for (const m of undecidedMoves(input.moves, today)) {
    nodes.push({
      id: `decide:${m.id}`,
      kind: 'decide',
      state: 'todo',
      moveId: m.id,
      situation: m.situation,
      candidates: input.candidates
        .filter((c) => c.moveId === m.id)
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ id: c.id, description: c.description })),
    });
  }

  // 3: 今日が予定日の active な習慣
  const doneToday = new Map(habitLogs.filter((l) => l.date === today && l.done).map((l) => [l.habitId, l.amount]));
  for (const h of todayHabits(habits, today)) nodes.push({
    id: `habit:${h.id}`,
    kind: 'habit',
    state: doneToday.has(h.id) ? 'done' : 'todo',
    habitId: h.id,
    name: h.name,
    intention: formatIntention(h),
    unit: h.unit,
    recordedAmount: doneToday.get(h.id) ?? null,
    weekCount: persona === 'optimist' ? weekCount(h, habitLogs, today) : null,
  });

  // 4: 今日のやること（1件だけ）
  const { task, others } = todayTask(tasks, today);
  if (task) {
    nodes.push({
      id: `task:${task.id}`,
      kind: 'task',
      state: startedOn(task, sessions, today) ? 'done' : 'todo',
      taskId: task.id,
      label: flags.roughStart && task.nextStep ? task.nextStep : task.title,
      title: task.title,
    });
  }

  // 5: 週次ふりかえり（金曜4:00〜翌週火曜4:00、D21）。完了したら done で残す
  const weekStart = reviewTargetWeek(today);
  if (weekStart) {
    const run = input.weeklyRuns.find((r) => r.weekStart === weekStart);
    nodes.push({ id: 'weekly', kind: 'weekly', state: run?.completedAt ? 'done' : 'todo', weekStart });
  }

  // 6: 1日のしめ（着手モジュールを使ったことがあるとき）
  if (input.startUsed) nodes.push({ id: 'daily', kind: 'daily', state: input.dailyDone ? 'done' : 'todo' });

  const next = nodes.find((n) => n.state !== 'done') ?? null;
  if (next) next.state = 'next';
  return { interrupts, nodes, nextNodeId: next?.id ?? null, otherTasks: others };
}
