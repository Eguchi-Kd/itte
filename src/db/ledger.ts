// 追記専用テーブルへの追加は必ずここを通す（§7.5）
import { computeHash, GENESIS_HASH, recordKey, verifyLedger, type LedgerResult } from '../domain/ledger';
import { IMMUTABLE_TABLES, type EpochMs, type ImmutableTable } from '../domain/types';
import { db as defaultDb, type ItteDB } from './db';

/** レコードの追加と台帳への追記を、同じ rw トランザクションで行う */
export async function appendImmutable<T extends object>(
  table: ImmutableTable,
  record: T,
  now: EpochMs,
  d: ItteDB = defaultDb,
): Promise<T> {
  return d.transaction('rw', [d.table(table), d.ledger], async () => {
    const last = await d.ledger.orderBy('seq').last();
    const prevHash = last?.hash ?? GENESIS_HASH;
    await d.table(table).add(record);
    await d.ledger.add({
      table,
      recordId: recordKey(table, record),
      hash: computeHash(prevHash, table, record),
      prevHash,
      at: now,
    });
    return record;
  });
}

/** 現在の DB の台帳を検証する */
export async function verifyDbLedger(d: ItteDB = defaultDb): Promise<LedgerResult> {
  return d.transaction('r', [d.ledger, ...IMMUTABLE_TABLES.map((t) => d.table(t))], async () => {
    const entries = await d.ledger.toArray();
    const records: Partial<Record<ImmutableTable, object[]>> = {};
    for (const t of IMMUTABLE_TABLES) records[t] = await d.table(t).toArray();
    return verifyLedger(entries, records);
  });
}
