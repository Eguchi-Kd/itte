import { beforeEach, describe, expect, it } from 'vitest';
import { canonicalJSON, computeHash, GENESIS_HASH, verifyLedger } from '../../domain/ledger';
import { db } from '../db';
import { appendImmutable, verifyDbLedger } from '../ledger';
import { NOW, resetDb, sampleRecords } from './helpers';

beforeEach(resetDb);

/** Dexie のフックを通さずに、IndexedDB を直接操作してレコードを書き換える */
async function rawPut(storeName: string, value: unknown): Promise<void> {
  const idb = db.backendDB();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('canonicalJSON', () => {
  it('キーを辞書順に並べ、空白なしで、undefined のキーを出さない', () => {
    expect(canonicalJSON({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[1,{"y":2,"z":1}]},"b":1}');
    expect(canonicalJSON({ a: null })).toBe('{"a":null}');
  });

  it('ハッシュは prevHash|table|canonicalJSON の SHA-256', () => {
    const h = computeHash(GENESIS_HASH, 'measurements', { id: 'x' });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(computeHash(GENESIS_HASH, 'measurements', { id: 'x' })).toBe(h);
    expect(computeHash(GENESIS_HASH, 'predictions', { id: 'x' })).not.toBe(h);
  });
});

describe('台帳', () => {
  it('AC-CORE-04: 追記専用レコードを3件追加すると verifyLedger が ok', async () => {
    const s = sampleRecords();
    await appendImmutable('measurements', s.measurements, NOW);
    await appendImmutable('judgments', s.judgments, NOW + 1);
    await appendImmutable('judgmentRequests', s.judgmentRequests, NOW + 2);

    const entries = await db.ledger.orderBy('seq').toArray();
    expect(entries.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(entries[0].prevHash).toBe(GENESIS_HASH);
    expect(entries[1].prevHash).toBe(entries[0].hash);
    expect(entries[2].prevHash).toBe(entries[1].hash);
    expect(entries[2].recordId).toBe('g1');
    expect(await verifyDbLedger()).toEqual({ ok: true, count: 3 });
  });

  it('AC-CORE-04: IndexedDB を直接操作して1件書き換えると、そのエントリの seq で ok: false', async () => {
    const s = sampleRecords();
    await appendImmutable('measurements', s.measurements, NOW);
    await appendImmutable('judgments', s.judgments, NOW + 1);
    await appendImmutable('commitments', s.commitments, NOW + 2);

    await rawPut('judgments', { ...s.judgments, outcome: 'MET', actualValue: 10 });

    const result = await verifyDbLedger();
    expect(result).toEqual({ ok: false, table: 'judgments', seq: 2, reason: 'hash' });
  });

  it('台帳の連鎖の改ざん、レコードの欠落、台帳にないレコードを検出する', () => {
    const s = sampleRecords();
    const h1 = computeHash(GENESIS_HASH, 'measurements', s.measurements);
    const h2 = computeHash(h1, 'goalFollowUps', s.goalFollowUps);
    const entries = [
      { seq: 1, table: 'measurements' as const, recordId: 'm1', hash: h1, prevHash: GENESIS_HASH, at: NOW },
      { seq: 2, table: 'goalFollowUps' as const, recordId: 'f1', hash: h2, prevHash: h1, at: NOW },
    ];
    const records = { measurements: [s.measurements], goalFollowUps: [s.goalFollowUps] };
    expect(verifyLedger(entries, records)).toEqual({ ok: true, count: 2 });

    const broken = [entries[0], { ...entries[1], prevHash: GENESIS_HASH }];
    expect(verifyLedger(broken, records)).toMatchObject({ ok: false, seq: 2, reason: 'chain' });

    expect(verifyLedger(entries, { measurements: [s.measurements] })).toMatchObject({
      ok: false,
      seq: 2,
      reason: 'missing',
    });

    const extra = { ...records, deadlineExtensions: [s.deadlineExtensions] };
    expect(verifyLedger(entries, extra)).toMatchObject({ ok: false, table: 'deadlineExtensions', reason: 'unlisted' });
  });

  it('台帳が空なら ok で 0件', () => {
    expect(verifyLedger([], {})).toEqual({ ok: true, count: 0 });
  });
});
