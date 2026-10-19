// 起動時の処理（§6.3.4）。1: 永続化の要求、2: 放置セッション、3: 期限到来、4: 足踏み、5: AppOpen の記録。初期データの投入もここで行う
import type { EpochMs, ID } from '../domain/types';
import { logicalDate } from '../domain/dates';
import { recordAppOpen } from './repo/common';
import { detectDueGoals, syncStallFlags } from './repo/goals';
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
  const today = logicalDate(now);
  await detectDueGoals(today, now);
  await syncStallFlags(today, now);
  await recordAppOpen(now);
  return { abandoned };
}
