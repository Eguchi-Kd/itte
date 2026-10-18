// 初期データ（§7.7）。初回起動時に投入する。手番トリガーの例は投入しない
import type { EpochMs, Joseki, ReasonTag, Settings } from '../domain/types';
import { db as defaultDb, type ItteDB } from './db';

export const INITIAL_REASON_TAGS = [
  '予定外の用事',
  '疲れ',
  '忘れた',
  '気分が乗らない',
  '体調',
  '前日の予定の影響',
  'その他',
] as const;

export const INITIAL_JOSEKI = [
  '戻せない手は保留する',
  '選択肢が増える手を優先する',
  '迷ったら評価関数に近い手を選ぶ',
] as const;

export function defaultSettings(now: EpochMs): Settings {
  return {
    id: 'singleton',
    onboarded: false,
    persona: null,
    personaScores: null,
    soundOn: true,
    hapticsOn: true,
    stallExtensionThreshold: 3,
    stallFollowUpDays: 30,
    stallRepeatedUnmet: 3,
    weeklyReviewIcs: { weekday: 0, time: '20:00' },
    lastExportAt: null,
    introSeen: [],
    dismissed: {},
    installPromptShown: false,
    createdAt: now,
  };
}

/** 設定がなければ既定値と初期データを入れる。2回目以降は何もしない */
export async function ensureSeed(now: EpochMs, d: ItteDB = defaultDb): Promise<void> {
  await d.transaction('rw', [d.settings, d.reasonTags, d.joseki], async () => {
    if (await d.settings.get('singleton')) return;
    await d.settings.add(defaultSettings(now));
    if ((await d.reasonTags.count()) === 0) {
      const tags: ReasonTag[] = INITIAL_REASON_TAGS.map((label, order) => ({
        id: crypto.randomUUID(),
        label,
        builtIn: true,
        archived: false,
        order,
      }));
      await d.reasonTags.bulkAdd(tags);
    }
    if ((await d.joseki.count()) === 0) {
      const joseki: Joseki[] = INITIAL_JOSEKI.map((principle, order) => ({
        id: crypto.randomUUID(),
        principle,
        origin: 'initial',
        moveReviewId: null,
        archived: false,
        order,
        createdAt: now,
      }));
      await d.joseki.bulkAdd(joseki);
    }
  });
}
