// バックアップの促し（割り込みカード5、§6.3.3）
import type { EpochMs } from './types';

export const BACKUP_INTERVAL_MS = 7 * 86_400_000;

/** lastExportAt が7日以上前、または未設定で記録が1件以上あるとき true */
export function backupDue(lastExportAt: EpochMs | null, hasRecords: boolean, now: EpochMs): boolean {
  if (lastExportAt === null) return hasRecords;
  return now - lastExportAt >= BACKUP_INTERVAL_MS;
}
