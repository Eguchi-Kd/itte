import type {
  Candidate,
  Countermeasure,
  EscapeLog,
  EvaluationFunction,
  Goal,
  Habit,
  HabitLog,
  Joseki,
  Judgment,
  Move,
  MoveReview,
  ReasonTag,
  Session,
  StallFlag,
  StuckLog,
  WeeklyCheck,
  WeeklyReviewRun,
} from '../../domain/types';
import { db } from '../db';

/** 週次ふりかえりに使う全データ（個人1名分なので全件読む） */
export interface WeeklyData {
  habits: Habit[];
  habitLogs: HabitLog[];
  checks: WeeklyCheck[];
  countermeasures: Countermeasure[];
  tags: ReasonTag[];
  sessions: Session[];
  stuckLogs: StuckLog[];
  escapeLogs: EscapeLog[];
  moves: Move[];
  candidates: Candidate[];
  moveReviews: MoveReview[];
  joseki: Joseki[];
  judgments: Judgment[];
  goals: Goal[];
  stallFlags: StallFlag[];
  efs: EvaluationFunction[];
  runs: WeeklyReviewRun[];
}

export async function queryWeeklyData(): Promise<WeeklyData> {
  const [
    habits,
    habitLogs,
    checks,
    countermeasures,
    tags,
    sessions,
    stuckLogs,
    escapeLogs,
    moves,
    candidates,
    moveReviews,
    joseki,
    judgments,
    goals,
    stallFlags,
    efs,
    runs,
  ] = await Promise.all([
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.weeklyChecks.toArray(),
    db.countermeasures.toArray(),
    db.reasonTags.toArray(),
    db.sessions.toArray(),
    db.stuckLogs.toArray(),
    db.escapeLogs.toArray(),
    db.moves.toArray(),
    db.candidates.toArray(),
    db.moveReviews.toArray(),
    db.joseki.toArray(),
    db.judgments.toArray(),
    db.goals.toArray(),
    db.stallFlags.toArray(),
    db.evaluationFunctions.toArray(),
    db.weeklyReviewRuns.toArray(),
  ]);
  return { habits, habitLogs, checks, countermeasures, tags, sessions, stuckLogs, escapeLogs, moves, candidates, moveReviews, joseki, judgments, goals, stallFlags, efs, runs };
}
