// 台帳（ハッシュ連鎖）の純粋関数（§7.5）
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { ImmutableTable, LedgerEntry } from './types';

export const GENESIS_HASH = '0'.repeat(64);

/** 追記専用テーブルの主キー */
export const IMMUTABLE_PRIMARY_KEY: Record<ImmutableTable, string> = {
  measurements: 'id',
  predictions: 'id',
  affectActuals: 'id',
  commitments: 'id',
  judgmentRequests: 'goalId',
  judgments: 'id',
  judgmentCorrections: 'id',
  deadlineExtensions: 'id',
  goalFollowUps: 'id',
};

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : normalize(v)));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = normalize(v);
    }
    return out;
  }
  return value;
}

/** キーを辞書順に並べ、空白なしで直列化する。undefined のキーは出力しない */
export function canonicalJSON(record: unknown): string {
  return JSON.stringify(normalize(record));
}

export function computeHash(prevHash: string, table: ImmutableTable, record: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(`${prevHash}|${table}|${canonicalJSON(record)}`)));
}

export function recordKey(table: ImmutableTable, record: object): string {
  return String((record as Record<string, unknown>)[IMMUTABLE_PRIMARY_KEY[table]]);
}

export type LedgerReason = 'chain' | 'hash' | 'missing' | 'unlisted';
export type LedgerResult =
  | { ok: true; count: number }
  | { ok: false; table: ImmutableTable; seq: number; reason: LedgerReason };

export type RecordsByTable = Partial<Record<ImmutableTable, readonly object[]>>;

/**
 * 台帳を検証する。
 * 1. seq 順に prevHash が前のエントリの hash と一致するか
 * 2. 現在のレコードからハッシュを再計算して一致するか
 * 3. レコードが存在しない、または台帳に載っていないレコードがないか
 */
export function verifyLedger(entries: readonly LedgerEntry[], recordsByTable: RecordsByTable): LedgerResult {
  const sorted = [...entries].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const index = new Map<string, object>();
  for (const [table, records] of Object.entries(recordsByTable) as [ImmutableTable, readonly object[]][]) {
    for (const r of records) index.set(`${table}\u0000${recordKey(table, r)}`, r);
  }

  const listed = new Set<string>();
  let prev = GENESIS_HASH;
  for (const e of sorted) {
    const seq = e.seq ?? 0;
    if (e.prevHash !== prev) return { ok: false, table: e.table, seq, reason: 'chain' };
    const k = `${e.table}\u0000${e.recordId}`;
    const record = index.get(k);
    if (!record) return { ok: false, table: e.table, seq, reason: 'missing' };
    if (computeHash(e.prevHash, e.table, record) !== e.hash) return { ok: false, table: e.table, seq, reason: 'hash' };
    listed.add(k);
    prev = e.hash;
  }

  const nextSeq = (sorted.at(-1)?.seq ?? 0) + 1;
  for (const k of index.keys()) {
    if (!listed.has(k)) {
      const table = k.split('\u0000')[0] as ImmutableTable;
      return { ok: false, table, seq: nextSeq, reason: 'unlisted' };
    }
  }
  return { ok: true, count: sorted.length };
}
