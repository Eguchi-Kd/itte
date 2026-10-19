import type { BoardItem, EvaluationFunction, Goal, TurnTrigger } from '../../domain/types';
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
