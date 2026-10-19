import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext } from 'react';
import type { Settings } from '../../domain/types';
import { querySettings } from '../../db/queries/settings';

/**
 * 画面の外枠（AppLayout）が購読した設定を配る。
 * 画面ごとに別々に購読すると更新の届く順がずれ、オンボーディング直後にリダイレクトで戻されることがある
 */
export const SettingsContext = createContext<Settings | null | undefined>(undefined);

/** 設定のライブクエリ（外枠で1回だけ使う） */
export function useSettingsQuery(): Settings | null | undefined {
  return useLiveQuery(async () => (await querySettings()) ?? null, []);
}

/** 設定を読む。読み込み中は undefined、まだ作られていなければ null。外枠の外では自分で購読する */
export function useSettings(): Settings | null | undefined {
  const fromLayout = useContext(SettingsContext);
  const inLayout = fromLayout !== undefined;
  const own = useLiveQuery(async () => (inLayout ? null : ((await querySettings()) ?? null)), [inLayout]);
  return inLayout ? fromLayout : own;
}
