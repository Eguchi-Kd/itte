// 書き出しと読み込み（§10.6、D39）、全データ削除（D6）、整合性の確認（§7.5）
import { zipSync, strToU8 } from 'fflate';
import { tablesToCsvFiles } from '../domain/csv';
import { logicalDate } from '../domain/dates';
import { DomainError } from '../domain/errors';
import { DATA_TABLES, exportSchema, fileDate, type DataTableName, type ExportData } from '../domain/exportSchema';
import { verifyLedger, type LedgerResult } from '../domain/ledger';
import { IMMUTABLE_TABLES, type EpochMs, type ImmutableTable } from '../domain/types';
import { db } from './db';
import { verifyDbLedger } from './ledger';

async function readAllTables(): Promise<Record<DataTableName, object[]>> {
  const out = {} as Record<DataTableName, object[]>;
  for (const t of DATA_TABLES) out[t] = await db.table(t).toArray();
  return out;
}

/** §8.12.4 の形式のデータを作る（lastExportAt は更新しない） */
export async function buildExport(now: EpochMs): Promise<ExportData> {
  const tables = await readAllTables();
  const ledger = await db.ledger.orderBy('seq').toArray();
  return exportSchema.parse({ app: 'itte', version: 1, exportedAt: new Date(now).toISOString(), tables, ledger });
}

async function touchExport(now: EpochMs): Promise<void> {
  await db.settings.update('singleton', { lastExportAt: now });
}

/** JSON 完全バックアップ。lastExportAt を更新する */
export async function exportJson(now: EpochMs): Promise<{ fileName: string; text: string }> {
  const data = await buildExport(now);
  await touchExport(now);
  return { fileName: `itte-backup-${fileDate(logicalDate(now))}.json`, text: JSON.stringify(data) };
}

/** CSV 一式を1つの zip に。各ファイルは BOM 付き UTF-8 */
export async function exportCsvZip(now: EpochMs): Promise<{ fileName: string; bytes: Uint8Array }> {
  const files = tablesToCsvFiles(await readAllTables());
  const bytes = zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
  await touchExport(now);
  return { fileName: `itte-csv-${fileDate(logicalDate(now))}.zip`, bytes };
}

export interface ImportSummary {
  counts: Partial<Record<DataTableName, number>>;
  ledger: number;
}

/** 読み込む前の検証。zod で形式を、台帳でハッシュ連鎖を確かめる。通らなければ DomainError */
export function validateImport(text: string): { data: ExportData; summary: ImportSummary } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DomainError('VALIDATION', 'errors.importInvalid');
  }
  const parsed = exportSchema.safeParse(json);
  if (!parsed.success) throw new DomainError('VALIDATION', 'errors.importInvalid', parsed.error.issues.slice(0, 5));
  const data = parsed.data;
  const records: Partial<Record<ImmutableTable, readonly object[]>> = {};
  for (const t of IMMUTABLE_TABLES) records[t] = data.tables[t];
  const result = verifyLedger(data.ledger, records);
  if (!result.ok) throw new DomainError('INTEGRITY', 'errors.importTampered', result);
  const counts: Partial<Record<DataTableName, number>> = {};
  for (const t of DATA_TABLES) counts[t] = data.tables[t].length;
  return { data, summary: { counts, ledger: data.ledger.length } };
}

/**
 * zod 検証 → 台帳検証 → 全置換（§10.6）。検証に通らなければ現在のデータは変えない。
 * 置換はデータベースを破棄して開き直し、1トランザクションで bulkAdd する（§7.5）
 */
export async function importJson(text: string, _now: EpochMs): Promise<ImportSummary> {
  const { data, summary } = validateImport(text);
  db.close();
  await db.delete();
  await db.open();
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.ledger], async () => {
    for (const t of DATA_TABLES) await db.table(t).bulkAdd(data.tables[t]);
    await db.ledger.bulkAdd(data.ledger);
  });
  return summary;
}

/** 全データ削除（データベースごと破棄、D6）。開き直した直後はすべてのテーブルが空 */
export async function wipeAll(): Promise<void> {
  db.close();
  await db.delete();
  await db.open();
}

/** 記録の整合性（台帳の検証） */
export function checkIntegrity(): Promise<LedgerResult> {
  return verifyDbLedger();
}
