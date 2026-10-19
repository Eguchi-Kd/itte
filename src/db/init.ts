// 起動時の処理（§6.3.4）。1: 永続化の要求、2: 放置セッションの検出、5: AppOpen の記録。初期データの投入もここで行う
import type { EpochMs, ID } from '../domain/types';
import { recordAppOpen } from './repo/common';
import { sweepAbandoned } from './repo/start';
import { ensureSeed } from './seed';

let persistRequested = false;

export interface LaunchResult {
  /** 放置として閉じたセッション（古い順）。最も新しいものについてだけ逃避ログを促す */
  abandoned: ID[];
}

export async function onLaunch(now: EpochMs): Promise<LaunchResult> {
  await ensureSeed(now);
  if (!persistRequested && typeof navigator !== 'undefined' && navigator.storage?.persist) {
    persistRequested = true;
    try {
      await navigator.storage.persist();
    } catch {
      // 永続化できない環境でも、そのまま使える
    }
  }
  const abandoned = await sweepAbandoned(now);
  await recordAppOpen(now);
  return { abandoned };
}
