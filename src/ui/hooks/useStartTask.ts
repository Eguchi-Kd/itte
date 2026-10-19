import { createContext, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router';
import { startSession } from '../../db/repo/start';
import type { ID } from '../../domain/types';
import { useFlags } from './useFlags';

export interface StartTaskApi {
  /** やることの10分タイマーを始める。感情予想のシートが必要ならシートを開く */
  start: (taskId: ID) => Promise<void>;
}

export const StartTaskContext = createContext<StartTaskApi | null>(null);

/** 外枠（StartTaskProvider）の中ではシートつきの開始、外では直接始める */
export function useStartTask(): (taskId: ID) => Promise<void> {
  const ctx = useContext(StartTaskContext);
  const navigate = useNavigate();
  const { roughStart } = useFlags();
  const direct = useCallback(
    async (taskId: ID) => {
      const s = await startSession(taskId, roughStart, null, Date.now());
      navigate(`/session/${s.id}`);
    },
    [navigate, roughStart],
  );
  return ctx ? ctx.start : direct;
}
