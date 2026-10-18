import { useLiveQuery } from 'dexie-react-hooks';
import type { Settings } from '../../domain/types';
import { querySettings } from '../../db/queries/settings';

/** 設定を購読する。読み込み中は undefined、まだ作られていなければ null */
export function useSettings(): Settings | null | undefined {
  return useLiveQuery(async () => (await querySettings()) ?? null, []);
}
