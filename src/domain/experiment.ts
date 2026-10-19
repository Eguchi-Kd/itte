// 実験の条件と機能フラグ（§9.2、D15）。実行中の実験は同時に1つだけ。実行中でないモジュールは常に B 条件
import { addDays, diffDays, weekdayOf } from './dates';
import type { Experiment, ExperimentPreset, ID, LocalDate, Phase } from './types';

export interface Flags {
  experimentId: ID | null;
  preset: ExperimentPreset | null;
  /** 開始日からの経過週（0始まり） */
  week: number | null;
  /** 実験中でなければ null */
  phase: Phase | null;
  /** 着手: ラフ登録の2項目、詰まりボタン、次の一手 */
  roughStart: boolean;
  /** 盤面: 読みシート（false なら簡易記録だけ） */
  readingSheet: boolean;
  /** 段: 判定待ちをホームと盤面に出す */
  judgmentEnforced: boolean;
}

export const ALL_B: Flags = {
  experimentId: null,
  preset: null,
  week: null,
  phase: null,
  roughStart: true,
  readingSheet: true,
  judgmentEnforced: true,
};

/** 週ごとの条件（§9.2 の表） */
export const PRESET_SCHEDULE: Record<ExperimentPreset, readonly Phase[]> = {
  start: ['A', 'B', 'A', 'B'],
  board: ['A', 'A', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B'],
  kizami: ['A', 'A', 'B', 'B', 'B', 'B', 'A', 'A', 'B', 'B', 'B', 'B'],
};

export function weekOf(startDate: LocalDate, today: LocalDate): number {
  return Math.floor(diffDays(today, startDate) / 7);
}

/** 開始日前は notStarted、長さを過ぎたら done。それ以外はその週の条件 */
export function phaseFor(preset: ExperimentPreset, startDate: LocalDate, today: LocalDate): Phase | 'done' | 'notStarted' {
  if (today < startDate) return 'notStarted';
  const w = weekOf(startDate, today);
  const schedule = PRESET_SCHEDULE[preset];
  return w >= schedule.length ? 'done' : schedule[w];
}

/** 中止されておらず、長さを過ぎていない実験（開始日前の予約も含む）。I17 の「実行中」 */
export function isRunning(e: Experiment, today: LocalDate): boolean {
  return e.stoppedAt === null && phaseFor(e.preset, e.startDate, today) !== 'done';
}

export function runningExperiment(experiments: readonly Experiment[], today: LocalDate): Experiment | null {
  return experiments.find((e) => isRunning(e, today)) ?? null;
}

/** 実験中の A 条件だけ、そのプリセットのフラグを false にする。開始日前・終了後・中止後はすべて true、phase=null */
export function computeFlags(experiments: readonly Experiment[], today: LocalDate): Flags {
  const e = runningExperiment(experiments, today);
  if (!e) return ALL_B;
  const phase = phaseFor(e.preset, e.startDate, today);
  if (phase === 'done' || phase === 'notStarted') return ALL_B;
  const a = phase === 'A';
  return {
    experimentId: e.id,
    preset: e.preset,
    week: weekOf(e.startDate, today),
    phase,
    roughStart: !(a && e.preset === 'start'),
    readingSheet: !(a && e.preset === 'board'),
    judgmentEnforced: !(a && e.preset === 'kizami'),
  };
}

/** 実験の週 k の期間（開始日からの7日区切り、D14） */
export function experimentWeek(startDate: LocalDate, k: number): { from: LocalDate; to: LocalDate } {
  const from = addDays(startDate, 7 * k);
  return { from, to: addDays(from, 6) };
}

/** 週 a〜b（両端を含む）をまとめた期間 */
export function experimentWeeks(startDate: LocalDate, a: number, b: number): { from: LocalDate; to: LocalDate } {
  return { from: experimentWeek(startDate, a).from, to: experimentWeek(startDate, b).to };
}

/** 次の月曜（今日が月曜なら7日後）。実験の開始日の既定値 */
export function nextMonday(today: LocalDate): LocalDate {
  const add = (8 - weekdayOf(today)) % 7 || 7;
  return addDays(today, add);
}
