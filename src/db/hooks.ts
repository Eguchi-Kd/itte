// 追記専用テーブルの不変性（§7.4 I2）。更新と削除をフックで止める
import type Dexie from 'dexie';
import { DomainError } from '../domain/errors';
import { IMMUTABLE_TABLES } from '../domain/types';

export function immutableError(table: string): DomainError {
  return new DomainError('IMMUTABLE', 'errors.immutable', { table });
}

export function installImmutabilityHooks(d: Dexie): void {
  for (const name of IMMUTABLE_TABLES) {
    const table = d.table(name);
    table.hook('updating', () => {
      throw immutableError(name);
    });
    table.hook('deleting', () => {
      throw immutableError(name);
    });
  }
}
