import type { Session, Task } from '../types';

export const NOW = new Date(2026, 9, 18, 12, 0).getTime();

export function task(p: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: '卒論の序章',
    roughVersion: '見出しだけ',
    firstAction: 'エディタを開く',
    nextStep: null,
    plannedFor: '2026-10-18',
    planHistory: [],
    boardItemId: null,
    goalId: null,
    createdAt: 0,
    archivedAt: null,
    closedReason: null,
    ...p,
  };
}

export function session(p: Partial<Session> = {}): Session {
  return {
    id: 's1',
    taskId: 't1',
    startedAt: NOW,
    endedAt: null,
    plannedMin: 10,
    outcome: null,
    roughMode: true,
    affectPredictionId: null,
    ...p,
  };
}
