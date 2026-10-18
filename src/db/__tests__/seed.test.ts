import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { getSettings, recordAppOpen, updateSettings } from '../repo/common';
import { ensureSeed, INITIAL_JOSEKI, INITIAL_REASON_TAGS } from '../seed';
import { NOW, resetDb } from './helpers';

beforeEach(resetDb);

describe('初期データ', () => {
  it('理由タグ7件、定跡3件、設定の既定値を入れ、手番トリガーは入れない。2回呼んでも増えない', async () => {
    await ensureSeed(NOW);
    await ensureSeed(NOW);
    const tags = await db.reasonTags.orderBy('order').toArray();
    expect(tags.map((t) => t.label)).toEqual([...INITIAL_REASON_TAGS]);
    expect(tags.every((t) => t.builtIn && !t.archived)).toBe(true);
    const joseki = await db.joseki.orderBy('order').toArray();
    expect(joseki.map((j) => j.principle)).toEqual([...INITIAL_JOSEKI]);
    expect(joseki.every((j) => j.origin === 'initial')).toBe(true);
    expect(await db.turnTriggers.count()).toBe(0);
    const s = await db.settings.get('singleton');
    expect(s).toMatchObject({
      onboarded: false,
      persona: null,
      soundOn: true,
      hapticsOn: true,
      stallExtensionThreshold: 3,
      stallFollowUpDays: 30,
      stallRepeatedUnmet: 3,
      weeklyReviewIcs: { weekday: 0, time: '20:00' },
      lastExportAt: null,
    });
  });
});

describe('設定のリポジトリ', () => {
  it('getSettings は初回に既定値で作り、updateSettings で一部を書き換える', async () => {
    const s = await getSettings(NOW);
    expect(s.onboarded).toBe(false);
    expect(await db.settings.count()).toBe(1);
    await updateSettings({ onboarded: true, persona: 'regret' }, NOW);
    const t = await getSettings(NOW);
    expect(t.onboarded).toBe(true);
    expect(t.persona).toBe('regret');
    expect(t.soundOn).toBe(true);
  });

  it('recordAppOpen は論理日ごとに1件だけ', async () => {
    await recordAppOpen(NOW);
    await recordAppOpen(NOW + 60_000);
    await recordAppOpen(new Date(2026, 9, 19, 3, 59).getTime());
    expect(await db.appOpens.count()).toBe(1);
    await recordAppOpen(new Date(2026, 9, 19, 4, 0).getTime());
    expect((await db.appOpens.toArray()).map((a) => a.date)).toEqual(['2026-10-18', '2026-10-19']);
  });
});
