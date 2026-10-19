import { createContext, useContext } from 'react';
import type { ID } from '../../domain/types';

export interface LaunchState {
  /** 起動時に放置として閉じたセッションのうち、逃避ログを促すもの（最も新しい1件） */
  escapeSessionId: ID | null;
  clearEscape: () => void;
}

export const LaunchContext = createContext<LaunchState>({ escapeSessionId: null, clearEscape: () => undefined });

export function useLaunch(): LaunchState {
  return useContext(LaunchContext);
}
