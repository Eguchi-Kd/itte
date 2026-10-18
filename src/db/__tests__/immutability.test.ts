import { beforeEach, describe, expect, it } from 'vitest';
import { IMMUTABLE_TABLES } from '../../domain/types';
import { IMMUTABLE_PRIMARY_KEY } from '../../domain/ledger';
import { db } from '../db';
import { appendImmutable } from '../ledger';
import { codeOfRejection, NOW, resetDb, sampleRecords } from './helpers';

beforeEach(resetDb);

describe('追記専用テーブルの不変性', () => {
  for (const table of IMMUTABLE_TABLES) {
    it(`AC-CORE-03: ${table} で update／put（既存キー）／delete が IMMUTABLE で失敗する`, async () => {
      const record = sampleRecords()[table];
      await appendImmutable(table, record, NOW);
      const key = record[IMMUTABLE_PRIMARY_KEY[table]] as string;
      const t = db.table(table);

      expect(await codeOfRejection(t.update(key, { createdAt: NOW + 1, at: NOW + 1 }))).toBe('IMMUTABLE');
      expect(await codeOfRejection(t.put({ ...record, requestedAt: NOW + 1, createdAt: NOW + 1 }))).toBe('IMMUTABLE');
      expect(await codeOfRejection(t.delete(key))).toBe('IMMUTABLE');
      expect(await codeOfRejection(t.bulkDelete([key]))).toBe('IMMUTABLE');
      expect(await codeOfRejection(t.bulkPut([{ ...record, createdAt: NOW + 2 }]))).toBe('IMMUTABLE');
      expect(await codeOfRejection(t.toCollection().modify({ createdAt: NOW + 3 }))).toBe('IMMUTABLE');
      expect(await codeOfRejection(t.toCollection().delete())).toBe('IMMUTABLE');
      expect(await codeOfRejection(t.clear())).toBe('IMMUTABLE');

      expect(await t.get(key)).toEqual(record);
      expect(await t.count()).toBe(1);
    });
  }

  it('追記専用でないテーブルは更新・削除できる', async () => {
    await db.joseki.add({
      id: 'k1',
      principle: 'a',
      origin: 'initial',
      moveReviewId: null,
      archived: false,
      order: 0,
      createdAt: NOW,
    });
    await db.joseki.update('k1', { archived: true });
    expect((await db.joseki.get('k1'))?.archived).toBe(true);
    await db.joseki.delete('k1');
    expect(await db.joseki.count()).toBe(0);
  });
});
