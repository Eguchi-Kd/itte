import type { BoardItem, Candidate, EvaluationFunction, Goal, Joseki, Move, TurnTrigger } from '../../domain/types';
import { db } from '../db';

export interface BoardData {
  efs: EvaluationFunction[];
  items: BoardItem[];
  goals: Goal[];
  triggers: TurnTrigger[];
  /** 盤面モジュールを使ったことがある（手か盤面の項目が1件以上） */
  boardUsed: boolean;
}

export async function queryBoardData(): Promise<BoardData> {
  const [efs, items, goals, triggers, moveCount] = await Promise.all([
    db.evaluationFunctions.orderBy('startDate').toArray(),
    db.boardItems.toArray(),
    db.goals.where('status').equals('OPEN').toArray(),
    db.turnTriggers.orderBy('createdAt').toArray(),
    db.moves.count(),
  ]);
  return { efs, items, goals, triggers, boardUsed: moveCount > 0 || items.length > 0 };
}

export function queryBoardItemById(id: string): Promise<BoardItem | undefined> {
  return db.boardItems.get(id);
}

/** 定跡（並び順）。初期定跡が先頭 */
export async function queryJoseki(): Promise<Joseki[]> {
  return (await db.joseki.orderBy('order').toArray()).sort(
    (a, b) => (a.origin === 'initial' ? 0 : 1) - (b.origin === 'initial' ? 0 : 1) || a.order - b.order,
  );
}

export interface MoveDetail {
  move: Move | null;
  candidates: Candidate[];
}

export async function queryMove(id: string): Promise<MoveDetail> {
  const [move, candidates] = await Promise.all([db.moves.get(id), db.candidates.where('moveId').equals(id).sortBy('position')]);
  return { move: move ?? null, candidates };
}

export async function queryMoves(): Promise<{ moves: Move[]; candidates: Candidate[] }> {
  const [moves, candidates] = await Promise.all([db.moves.orderBy('createdAt').reverse().toArray(), db.candidates.toArray()]);
  return { moves, candidates };
}

export function queryMoveReview(moveId: string) {
  return db.moveReviews.where('moveId').equals(moveId).first();
}
