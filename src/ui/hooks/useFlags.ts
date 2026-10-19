import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext } from 'react';
import { queryExperiments } from '../../db/queries/experiment';
import { logicalDate } from '../../domain/dates';
import { ALL_B, computeFlags, type Flags } from '../../domain/experiment';
import { useNow } from './useNow';

/** 外枠（AppLayout）が計算した機能フラグを配る。画面ごとに購読すると、届く前の操作が B 条件で動いてしまうため */
export const FlagsContext = createContext<Flags | undefined>(undefined);

/** 実験のライブクエリから機能フラグを計算する（外枠で1回だけ使う）。読み込み中は undefined */
export function useFlagsQuery(): Flags | undefined {
  const today = logicalDate(useNow());
  const experiments = useLiveQuery(() => queryExperiments(), []);
  return experiments ? computeFlags(experiments, today) : undefined;
}

/** 機能フラグ（§9.2）。実行中の実験の A 条件だけ、そのプリセットの機能を切る */
export function useFlags(): Flags {
  const fromLayout = useContext(FlagsContext);
  const own = useFlagsQuery();
  return fromLayout ?? own ?? ALL_B;
}
