// 共通のリポジトリ関数（§7.6）
import { logicalDate } from '../../domain/dates';
import type { EpochMs, Settings } from '../../domain/types';
import { db } from '../db';
import { defaultSettings } from '../seed';

/** 設定を読む。初回は既定値で作る */
export async function getSettings(now: EpochMs): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const s = await db.settings.get('singleton');
    if (s) return s;
    const created = defaultSettings(now);
    await db.settings.add(created);
    return created;
  });
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>, now: EpochMs): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get('singleton')) ?? defaultSettings(now);
    const next: Settings = { ...current, ...patch, id: 'singleton' };
    await db.settings.put(next);
    return next;
  });
}

/** 今日の AppOpen がなければ追加する */
export async function recordAppOpen(now: EpochMs): Promise<void> {
  const date = logicalDate(now);
  await db.transaction('rw', db.appOpens, async () => {
    if (!(await db.appOpens.get(date))) await db.appOpens.add({ date, firstAt: now });
  });
}

/** オンボーディングを終える。診断をとばしたときは persona=null（§6.4） */
export async function completeOnboarding(
  scores: Settings['personaScores'],
  persona: Settings['persona'],
  now: EpochMs,
): Promise<Settings> {
  return updateSettings({ onboarded: true, persona, personaScores: scores }, now);
}
