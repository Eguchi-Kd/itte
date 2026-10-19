// 盤面のリポジトリ（§7.6）【盤】。感想戦（saveMoveReview）は週次ふりかえり（T28）で足す
import { MAX_ACTIVE_TRIGGERS, MAX_AVOID, periodsOverlap } from '../../domain/board/board';
import { filledCandidates, validateCandidates, type CandidateInput } from '../../domain/board/moves';
import { DomainError } from '../../domain/errors';
import type {
  BoardItem,
  BoardItemType,
  Candidate,
  EpochMs,
  EvaluationFunction,
  ID,
  Joseki,
  LocalDate,
  Move,
  Phase,
  TurnTrigger,
} from '../../domain/types';
import { db } from '../db';

const newId = () => crypto.randomUUID();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function requireText(v: string, max: number, field: string): string {
  const t = v.trim();
  if (t.length < 1) throw new DomainError('VALIDATION', 'errors.required', { field });
  if (t.length > max) throw new DomainError('VALIDATION', 'errors.tooLong', { field, n: max });
  return t;
}

export interface EvaluationInput {
  id?: ID;
  metric: string;
  avoid: string[];
  startDate: LocalDate;
  endDate: LocalDate;
}

/** 評価関数を保存する。期間（両端を含む）が既存と重なれば PERIOD_OVERLAP（I10） */
export async function saveEvaluationFunction(input: EvaluationInput, now: EpochMs): Promise<EvaluationFunction> {
  const metric = requireText(input.metric, 100, 'metric');
  const avoid = input.avoid.map((a) => a.trim()).filter((a) => a.length > 0);
  if (avoid.length > MAX_AVOID) throw new DomainError('VALIDATION', 'errors.tooLong', { field: 'avoid' });
  avoid.forEach((a) => requireText(a, 100, 'avoid'));
  if (!DATE_RE.test(input.startDate) || !DATE_RE.test(input.endDate) || input.endDate <= input.startDate) {
    throw new DomainError('VALIDATION', 'errors.required', { field: 'period' });
  }
  return db.transaction('rw', db.evaluationFunctions, async () => {
    const others = (await db.evaluationFunctions.toArray()).filter((e) => e.id !== input.id);
    if (others.some((e) => periodsOverlap(e, input))) {
      throw new DomainError('PERIOD_OVERLAP', 'errors.periodOverlap');
    }
    const existing = input.id ? await db.evaluationFunctions.get(input.id) : undefined;
    const ef: EvaluationFunction = {
      id: existing?.id ?? newId(),
      metric,
      avoid,
      startDate: input.startDate,
      endDate: input.endDate,
      createdAt: existing?.createdAt ?? now,
    };
    await db.evaluationFunctions.put(ef);
    return ef;
  });
}

export interface BoardItemInput {
  id?: ID;
  type: BoardItemType;
  title: string;
  dueDate: LocalDate | null;
}

export async function saveBoardItem(input: BoardItemInput, now: EpochMs): Promise<BoardItem> {
  const title = requireText(input.title, 200, 'title');
  if (input.dueDate !== null && !DATE_RE.test(input.dueDate)) throw new DomainError('VALIDATION', 'errors.required');
  return db.transaction('rw', db.boardItems, async () => {
    const existing = input.id ? await db.boardItems.get(input.id) : undefined;
    const item: BoardItem = {
      id: existing?.id ?? newId(),
      type: input.type,
      title,
      dueDate: input.dueDate,
      status: existing?.status ?? 'open',
      source: existing?.source ?? 'manual',
      externalUid: existing?.externalUid ?? null,
      createdAt: existing?.createdAt ?? now,
    };
    await db.boardItems.put(item);
    return item;
  });
}

export async function setBoardItemStatus(id: ID, status: 'open' | 'done', _now: EpochMs): Promise<void> {
  const n = await db.boardItems.update(id, { status });
  if (n === 0) throw new DomainError('NOT_FOUND', 'errors.notFound', { id });
}

/** 削除する。取り消し用に呼び出し側が元の値を持つので、消した項目を返す */
export async function deleteBoardItem(id: ID): Promise<BoardItem | null> {
  return db.transaction('rw', db.boardItems, async () => {
    const item = (await db.boardItems.get(id)) ?? null;
    if (item) await db.boardItems.delete(id);
    return item;
  });
}

/** 削除の取り消し */
export async function restoreBoardItem(item: BoardItem): Promise<void> {
  await db.boardItems.put(item);
}

async function activeCount(exceptId?: ID): Promise<number> {
  return (await db.turnTriggers.toArray()).filter((t) => t.active && t.id !== exceptId).length;
}

/** 手番トリガーを保存する。有効なものは最大5件（I9） */
export async function saveTrigger(
  input: { id?: ID; conditionText: string; active: boolean },
  now: EpochMs,
): Promise<TurnTrigger> {
  const conditionText = requireText(input.conditionText, 200, 'conditionText');
  return db.transaction('rw', db.turnTriggers, async () => {
    if (input.active && (await activeCount(input.id)) >= MAX_ACTIVE_TRIGGERS) {
      throw new DomainError('LIMIT_EXCEEDED', 'errors.triggerLimit');
    }
    const existing = input.id ? await db.turnTriggers.get(input.id) : undefined;
    const t: TurnTrigger = { id: existing?.id ?? newId(), conditionText, active: input.active, createdAt: existing?.createdAt ?? now };
    await db.turnTriggers.put(t);
    return t;
  });
}

export async function setTriggerActive(id: ID, active: boolean, _now: EpochMs): Promise<void> {
  await db.transaction('rw', db.turnTriggers, async () => {
    const t = await db.turnTriggers.get(id);
    if (!t) throw new DomainError('NOT_FOUND', 'errors.notFound', { id });
    if (active && !t.active && (await activeCount(id)) >= MAX_ACTIVE_TRIGGERS) {
      throw new DomainError('LIMIT_EXCEEDED', 'errors.triggerLimit');
    }
    await db.turnTriggers.update(id, { active });
  });
}

export interface MoveInput {
  situation: string;
  triggerId: ID | null;
  irreversible: boolean;
  unreadable: boolean;
  candidates: CandidateInput[];
  /** 盤面プリセットの実験中に作られた場合の条件 */
  phase?: Phase | null;
}

/** 読みシートの手と候補を1トランザクションで作る（I11）。候補は配列順に position 1 から */
export async function createMove(input: MoveInput, now: EpochMs): Promise<{ move: Move; candidates: Candidate[] }> {
  const situation = requireText(input.situation, 200, 'situation');
  const cands = filledCandidates(input.candidates);
  if (!validateCandidates(cands)) throw new DomainError('VALIDATION', 'errors.candidates');
  return db.transaction('rw', db.moves, db.candidates, async () => {
    const move: Move = {
      id: newId(),
      triggerId: input.triggerId,
      situation,
      mode: 'full',
      retro: false,
      irreversible: input.irreversible,
      unreadable: input.unreadable,
      chosenCandidateId: null,
      chosenText: null,
      decidedAt: null,
      phase: input.phase ?? null,
      createdAt: now,
    };
    const candidates: Candidate[] = cands.map((c, i) => ({
      id: newId(),
      moveId: move.id,
      position: (i + 1) as 1 | 2 | 3,
      description: c.description.trim(),
      plus1: c.plus1?.trim() ? c.plus1.trim() : null,
      plus2: c.plus2?.trim() ? c.plus2.trim() : null,
      score: c.score,
    }));
    await db.moves.add(move);
    await db.candidates.bulkAdd(candidates);
    return { move, candidates };
  });
}

/** 簡易記録（D31）。mode='quick'、decidedAt=now、候補0件で chosenText 必須 */
export async function createQuickMove(
  input: { situation: string; chosenText: string; retro: boolean; phase?: Phase | null },
  now: EpochMs,
): Promise<Move> {
  const move: Move = {
    id: newId(),
    triggerId: null,
    situation: requireText(input.situation, 200, 'situation'),
    mode: 'quick',
    retro: input.retro,
    irreversible: false,
    unreadable: false,
    chosenCandidateId: null,
    chosenText: requireText(input.chosenText, 200, 'chosenText'),
    decidedAt: now,
    phase: input.phase ?? null,
    createdAt: now,
  };
  await db.moves.add(move);
  return move;
}

/** 手を決める。候補は同じ手のものだけ（I12） */
export async function decideMove(moveId: ID, candidateId: ID, now: EpochMs): Promise<Move> {
  return db.transaction('rw', db.moves, db.candidates, async () => {
    const move = await db.moves.get(moveId);
    if (!move) throw new DomainError('NOT_FOUND', 'errors.notFound', { moveId });
    const cand = await db.candidates.get(candidateId);
    if (!cand || cand.moveId !== moveId || move.mode !== 'full') {
      throw new DomainError('VALIDATION', 'errors.candidates', { moveId, candidateId });
    }
    const next: Move = { ...move, chosenCandidateId: candidateId, decidedAt: now };
    await db.moves.put(next);
    return next;
  });
}

/** 定跡の追加・編集・非表示 */
export async function saveJoseki(
  input: { id?: ID; principle: string; archived?: boolean; moveReviewId?: ID | null },
  now: EpochMs,
): Promise<Joseki> {
  const principle = requireText(input.principle, 100, 'principle');
  return db.transaction('rw', db.joseki, async () => {
    const existing = input.id ? await db.joseki.get(input.id) : undefined;
    const j: Joseki = {
      id: existing?.id ?? newId(),
      principle,
      origin: existing?.origin ?? (input.moveReviewId ? 'review' : 'initial'),
      moveReviewId: existing?.moveReviewId ?? input.moveReviewId ?? null,
      archived: input.archived ?? existing?.archived ?? false,
      order: existing?.order ?? (await db.joseki.count()),
      createdAt: existing?.createdAt ?? now,
    };
    await db.joseki.put(j);
    return j;
  });
}
