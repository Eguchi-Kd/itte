import type { Settings } from '../../domain/types';
import { db } from '../db';

export function querySettings(): Promise<Settings | undefined> {
  return db.settings.get('singleton');
}
