import { createContext, useContext } from 'react';

/** ホーム画面に追加できる手段（§6.3.3 割り込みカード6） */
export type InstallMethod = 'prompt' | 'ios' | null;

export interface InstallState {
  /** すでにホーム画面から単体で起動している */
  installed: boolean;
  /** Android: beforeinstallprompt を受け取った。iOS: 共有メニューの手順を出す。どちらでもなければ null */
  method: InstallMethod;
  /** beforeinstallprompt のダイアログを出す */
  prompt: () => Promise<void>;
}

export const InstallContext = createContext<InstallState>({ installed: false, method: null, prompt: async () => undefined });

export function useInstall(): InstallState {
  return useContext(InstallContext);
}
