import { useCallback } from 'react';
import { recordDone, recordMissed, revertLog, undoLog } from '../../db/repo/habits';
import type { ID, LocalDate } from '../../domain/types';
import { useFeedback } from '../feedback/FeedbackProvider';

/** 習慣の記録操作。記録したら結果に依存しないフィードバックと「取り消す」を出す */
export function useHabitActions() {
  const { notify } = useFeedback();

  const done = useCallback(
    async (habitId: ID, date: LocalDate, amount?: number) => {
      const change = await recordDone(habitId, date, amount, Date.now());
      notify({ type: 'habitDone' }, { undo: () => void revertLog(habitId, date, change.previous, Date.now()) });
    },
    [notify],
  );

  const missed = useCallback(
    async (habitId: ID, date: LocalDate, tagIds: ID[]) => {
      const change = await recordMissed(habitId, date, tagIds, null, Date.now());
      notify({ type: 'habitMissed' }, { undo: () => void revertLog(habitId, date, change.previous, Date.now()) });
    },
    [notify],
  );

  const undo = useCallback(async (habitId: ID, date: LocalDate) => {
    await undoLog(habitId, date, Date.now());
  }, []);

  return { done, missed, undo };
}
