// 起動時の処理（§6.3.4）。M1 では 1（永続化の要求）と 5（AppOpen の記録）と初期データの投入を行う
import type { EpochMs } from '../domain/types';
import { recordAppOpen } from './repo/common';
import { ensureSeed } from './seed';

let persistRequested = false;

export async function onLaunch(now: EpochMs): Promise<void> {
  await ensureSeed(now);
  if (!persistRequested && typeof navigator !== 'undefined' && navigator.storage?.persist) {
    persistRequested = true;
    try {
      await navigator.storage.persist();
    } catch {
      // 永続化できない環境でも、そのまま使える
    }
  }
  await recordAppOpen(now);
}
