import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { startSession } from '../../db/repo/start';
import type { ID } from '../../domain/types';
import { useFlags } from './useFlags';

/** やることの10分タイマーを始めて、タイマー画面へ移る */
export function useStartTask() {
  const navigate = useNavigate();
  const { roughStart } = useFlags();
  return useCallback(
    async (taskId: ID) => {
      const s = await startSession(taskId, roughStart, null, Date.now());
      navigate(`/session/${s.id}`);
    },
    [navigate, roughStart],
  );
}
