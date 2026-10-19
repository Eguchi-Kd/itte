// セッション（§8.4）【着】。transition は副作用の指示を返す純粋関数で、リポジトリ関数がそれを適用する
import { DomainError } from '../errors';
import type { EpochMs, ID, Session, SessionOutcome, StuckChoice, StuckLog } from '../types';

export const SESSION_MS = 10 * 60_000;
export const ABANDON_MS = 40 * 60_000;

export function remainingMs(s: Pick<Session, 'startedAt' | 'endedAt'>, now: EpochMs): number {
  return s.endedAt === null ? Math.max(0, s.startedAt + SESSION_MS - now) : 0;
}

export type SessionState = 'running' | 'ending' | 'closed';

export function sessionState(s: Pick<Session, 'startedAt' | 'endedAt'>, now: EpochMs): SessionState {
  if (s.endedAt !== null) return 'closed';
  return remainingMs(s, now) > 0 ? 'running' : 'ending';
}

/** 取り組んだ分数。閉じていれば終了時刻まで、開いていれば今まで（最大10分） */
export function spentMinutes(s: Pick<Session, 'startedAt' | 'endedAt'>, now: EpochMs): number {
  const end = s.endedAt ?? Math.min(now, s.startedAt + SESSION_MS);
  return Math.max(0, Math.round((end - s.startedAt) / 60_000));
}

export type SessionEvent =
  | { type: 'start'; taskId: ID; roughMode: boolean; affectPredictionId?: ID | null }
  | { type: 'stuck'; choice: StuckChoice; blocker: string }
  | { type: 'interrupt' }
  | { type: 'continue' }
  | { type: 'stop'; nextStep: string | null }
  | { type: 'abandon' };

export interface SessionEffects {
  /** 閉じるセッション */
  close?: { id: ID; endedAt: EpochMs; outcome: SessionOutcome };
  /** 新しく作るセッション */
  create?: Session;
  stuckLog?: StuckLog;
  /** やることの次の一手を更新する */
  nextStep?: { taskId: ID; value: string | null };
  /** 画面の遷移先 */
  goTo?: 'timer' | 'end' | 'home';
  /** 逃避ログを促すシートを出す */
  promptEscape?: boolean;
}

function conflict(detail: unknown): DomainError {
  return new DomainError('CONFLICT', 'errors.unknown', detail);
}

/**
 * §8.4.2 の遷移。session は現在のセッション（「始める」のときは null）
 */
export function transition(session: Session | null, event: SessionEvent, now: EpochMs, newId: () => ID): SessionEffects {
  if (event.type === 'start') {
    return {
      create: {
        id: newId(),
        taskId: event.taskId,
        startedAt: now,
        endedAt: null,
        plannedMin: 10,
        outcome: null,
        roughMode: event.roughMode,
        affectPredictionId: event.affectPredictionId ?? null,
      },
      goTo: 'timer',
    };
  }
  if (!session) throw conflict({ event: event.type });
  const state = sessionState(session, now);

  switch (event.type) {
    case 'stuck': {
      if (state !== 'running') throw conflict({ state, event: event.type });
      const stuckLog: StuckLog = {
        id: newId(),
        sessionId: session.id,
        taskId: session.taskId,
        at: now,
        blocker: event.blocker,
        choice: event.choice,
      };
      if (event.choice === 'stop') {
        return { stuckLog, close: { id: session.id, endedAt: now, outcome: 'stopped' }, goTo: 'end' };
      }
      return { stuckLog };
    }
    case 'interrupt':
      if (state !== 'running') throw conflict({ state, event: event.type });
      return { close: { id: session.id, endedAt: now, outcome: 'stopped' }, goTo: 'end' };
    case 'continue':
      if (state === 'closed') throw conflict({ state, event: event.type });
      return {
        close: { id: session.id, endedAt: now, outcome: 'continued' },
        create: {
          id: newId(),
          taskId: session.taskId,
          startedAt: now,
          endedAt: null,
          plannedMin: 10,
          outcome: null,
          roughMode: session.roughMode,
          affectPredictionId: null,
        },
        goTo: 'timer',
      };
    case 'stop':
      // ending なら閉じる。中断・詰まりで閉じた後の終了画面では次の一手だけを更新する
      return {
        ...(state === 'closed' ? {} : { close: { id: session.id, endedAt: now, outcome: 'stopped' as const } }),
        nextStep: { taskId: session.taskId, value: event.nextStep },
        goTo: 'home',
      };
    case 'abandon':
      if (state === 'closed' || now - session.startedAt < ABANDON_MS) throw conflict({ state, event: event.type });
      return {
        close: { id: session.id, endedAt: session.startedAt + SESSION_MS, outcome: 'abandoned' },
        promptEscape: true,
      };
  }
}

/** endedAt === null かつ開始から40分以上のセッション（古い順） */
export function findAbandoned(sessions: readonly Session[], now: EpochMs): Session[] {
  return sessions
    .filter((s) => s.endedAt === null && now - s.startedAt >= ABANDON_MS)
    .sort((a, b) => a.startedAt - b.startedAt);
}

/** 進行中のセッション（endedAt = null で、開始から10分未満）。割り込みカード1 */
export function activeSession(sessions: readonly Session[], now: EpochMs): Session | null {
  return sessions.filter((s) => sessionState(s, now) === 'running').sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
}
