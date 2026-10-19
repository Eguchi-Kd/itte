import { DEFAULT_PATH_FLAGS, type PathFlags } from '../../domain/path';

export interface UiFlags extends PathFlags {
  /** 盤面: 読みシート（false なら簡易記録だけ） */
  readingSheet: boolean;
}

/** 機能フラグ（§9.2）。実験ランナー（T30）ができるまでは、すべて B 条件（true） */
export function useFlags(): UiFlags {
  return { ...DEFAULT_PATH_FLAGS, readingSheet: true };
}
