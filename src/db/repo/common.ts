// 共通のリポジトリ関数（§7.6）
import { logicalDate } from '../../domain/dates';
import { DomainError } from '../../domain/errors';
import { runningExperiment } from '../../domain/experiment';
import type { EpochMs, Experiment, ExperimentPreset, LocalDate, Settings, WeeklyReviewRun } from '../../domain/types';
import { db } from '../db';
import { defaultSettings, ensureSeed } from '../seed';

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

/** 週次ふりかえりの開始・カーソル更新・完了（§7.6）。週ごとに1件 */
export async function upsertWeeklyReviewRun(
  weekStart: LocalDate,
  patch: { cursor?: number; completed?: boolean },
  now: EpochMs,
): Promise<WeeklyReviewRun> {
  return db.transaction('rw', db.weeklyReviewRuns, async () => {
    const existing = await db.weeklyReviewRuns.where('weekStart').equals(weekStart).first();
    const run: WeeklyReviewRun = {
      id: existing?.id ?? crypto.randomUUID(),
      weekStart,
      startedAt: existing?.startedAt ?? now,
      completedAt: patch.completed ? now : (existing?.completedAt ?? null),
      cursor: patch.cursor ?? existing?.cursor ?? 0,
    };
    await db.weeklyReviewRuns.put(run);
    return run;
  });
}

/** 実験を始める。実行中の実験（予約を含む）があれば CONFLICT（I17） */
export async function startExperiment(preset: ExperimentPreset, startDate: LocalDate, now: EpochMs): Promise<Experiment> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new DomainError('VALIDATION', 'errors.required', { startDate });
  return db.transaction('rw', db.experiments, async () => {
    if (runningExperiment(await db.experiments.toArray(), logicalDate(now))) {
      throw new DomainError('CONFLICT', 'errors.experimentRunning');
    }
    const e: Experiment = { id: crypto.randomUUID(), preset, startDate, stoppedAt: null, createdAt: now };
    await db.experiments.add(e);
    return e;
  });
}

/** 実験を中止する（stoppedAt を入れる） */
export async function stopExperiment(id: string, now: EpochMs): Promise<void> {
  await db.transaction('rw', db.experiments, async () => {
    const e = await db.experiments.get(id);
    if (e && e.stoppedAt === null) await db.experiments.update(id, { stoppedAt: now });
  });
}

// 書き出し・読み込み・全削除（§7.6 の共通の関数。実装は db/backup.ts）
export { exportCsvZip, exportJson, importJson, validateImport, wipeAll, type ImportSummary } from '../backup';

/** 全データ削除のあと、オンボーディングから始められるよう設定と初期データを入れ直す */
export async function startFresh(now: EpochMs): Promise<void> {
  await ensureSeed(now);
}

/** 「はじめての○○」カードを見たことを残す（§4.2、introSeen） */
export async function markIntroSeen(id: string, now: EpochMs): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get('singleton')) ?? defaultSettings(now);
    if (current.introSeen.includes(id)) return;
    await db.settings.put({ ...current, introSeen: [...current.introSeen, id] });
  });
}
