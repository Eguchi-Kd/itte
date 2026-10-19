import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { csvToRecords, parseCsv } from '../../domain/csv';
import { dayStart } from '../../domain/dates';
import { DATA_TABLES, type DataTableName } from '../../domain/exportSchema';
import { calibrationError, calibrationSeries, medianDelayHours } from '../../domain/goals/calibration';
import type { AppOpen, Goal, GoalFollowUp, Judgment, JudgmentCorrection, Metric, Prediction } from '../../domain/types';
import { kizamiRate, usageRate } from '../../domain/verify/metrics';
import { db, SCHEMA_V1 } from '../db';
import { checkIntegrity, exportCsvZip, exportJson, importJson, wipeAll } from '../backup';
import { createMove, decideMove, importIcs, saveMoveReview } from '../repo/board';
import { recordAppOpen } from '../repo/common';
import { chooseFollowUp, correctJudgment, createGoal, extendDeadline, judge, recordMeasurement, saveMetric } from '../repo/goals';
import { recordDone, saveHabit } from '../repo/habits';
import { createTask, recordStuck, startSession } from '../repo/start';
import { codeOfRejection, habitDraft, NOW, resetSeeded, taskInput } from './helpers';

const DAY = 86_400_000;
const cand = (description: string) => ({ description, plus1: null, plus2: null, score: 1 as const });

/** 全モジュールにわたるデータを作る */
async function populate() {
  await recordAppOpen(NOW);
  const h = await saveHabit(habitDraft(), NOW - 5 * DAY);
  await recordDone(h.id, '2026-10-17', undefined, NOW);
  const t = await createTask(taskInput(), true, NOW);
  const s = await startSession(t.id, true, null, NOW);
  await recordStuck(s.id, '構成', 'fill', NOW + 60_000);
  const { move, candidates } = await createMove({ situation: '誘い', triggerId: null, irreversible: true, unreadable: false, candidates: [cand('行く'), cand('断る')] }, NOW);
  await decideMove(move.id, candidates[0].id, NOW);
  await saveMoveReview({ moveId: move.id, outcome: '楽しかった', judgmentOk: true, rating: 'bad', blindSpot: 'reading', note: null, promoteToJoseki: '一晩おく' }, NOW);
  const m = await saveMetric({ name: '章数', unit: '章', direction: 'HIGHER_IS_BETTER', collectionMethod: '数える', verifiable: true }, NOW - 20 * DAY);
  await recordMeasurement({ metricId: m.id, value: 1, measuredAt: NOW - 12 * DAY, note: 'メモ, 引用"あり"' }, NOW - 12 * DAY);
  const g = await createGoal(
    { metricId: m.id, title: '章を3つ', targetValue: 3, comparator: 'GTE', deadline: '2026-10-15', onMet: '次へ', onUnmet: '絞る', probability: 60, predictedValue: 3 },
    dayStart('2026-10-01'),
  );
  const open = await createGoal(
    { metricId: m.id, title: '開いた段', targetValue: 2, comparator: 'GTE', deadline: '2026-10-25', onMet: 'a', onUnmet: 'b', probability: 40, predictedValue: 1 },
    NOW,
  );
  await extendDeadline(open.id, '2026-10-30', '発表が入った', '2026-10-18', NOW);
  const j = await judge(g.id, 2, { investedHours: 12.5, costNote: '週末' }, { enforced: true }, NOW);
  await correctJudgment(j.id, 'actualValue', 2.5, '数え直し', NOW + 1000);
  await chooseFollowUp(g.id, 'KIZAMI', NOW);
  return { g, j };
}

async function snapshot(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of [...DATA_TABLES, 'ledger']) {
    const rows = await db.table(t).toArray();
    // 主キーの順にそろえる（キーの並びは比べない）
    const key = (r: Record<string, unknown>) => String(r.id ?? r.seq ?? r.date ?? r.goalId).padStart(20, '0');
    out[t] = rows.sort((a, b) => key(a).localeCompare(key(b)));
  }
  return out;
}

beforeEach(async () => {
  await resetSeeded({ onboarded: true, persona: 'optimist' });
});

describe('JSON の書き出しと読み込み', () => {
  it('AC-DATA-01: JSON の書き出し → 全削除 → 読み込みで、全テーブルが元と一致する', async () => {
    await populate();
    // 書き出す時点のデータと比べる（書き出しの操作そのものが lastExportAt を更新するので、その前に取る）
    const before = await snapshot();
    const { text, fileName } = await exportJson(NOW);
    expect(fileName).toBe('itte-backup-20261018.json');
    await wipeAll();
    const summary = await importJson(text, NOW);
    expect(summary.counts.goals).toBe(2);
    const after = await snapshot();
    expect(after).toEqual(before);
    expect(await checkIntegrity()).toMatchObject({ ok: true });
  });

  it('AC-DATA-02: 書き出した JSON の判定の actualValue を書き換えて読み込むと拒否され、現在のデータは変わらない', async () => {
    const { j } = await populate();
    const { text } = await exportJson(NOW);
    const data = JSON.parse(text);
    data.tables.judgments[0].actualValue = 3;
    data.tables.judgments[0].outcome = 'MET';
    const before = await snapshot();
    expect(await codeOfRejection(importJson(JSON.stringify(data), NOW))).toBe('INTEGRITY');
    expect(await snapshot()).toEqual(before);
    expect((await db.judgments.get(j.id))?.actualValue).toBe(2);
  });

  it('AC-DATA-03: スキーマに合わない JSON は拒否され、現在のデータは変わらない', async () => {
    await populate();
    const { text } = await exportJson(NOW);
    const before = await snapshot();
    const noDeadline = JSON.parse(text);
    delete noDeadline.tables.goals[0].deadline;
    const missingTable = JSON.parse(text);
    delete missingTable.tables.habits;
    const wrongApp = { ...JSON.parse(text), app: 'other' };
    for (const bad of [JSON.stringify(noDeadline), JSON.stringify(missingTable), JSON.stringify(wrongApp), '{not json', '[]']) {
      expect(await codeOfRejection(importJson(bad, NOW))).toBe('VALIDATION');
    }
    expect(await snapshot()).toEqual(before);
  });

  it('AC-DATA-07: 書き出しで lastExportAt が更新される', async () => {
    await populate();
    expect((await db.settings.get('singleton'))?.lastExportAt).toBeNull();
    await exportJson(NOW + 5000);
    expect((await db.settings.get('singleton'))?.lastExportAt).toBe(NOW + 5000);
    await exportCsvZip(NOW + 9000);
    expect((await db.settings.get('singleton'))?.lastExportAt).toBe(NOW + 9000);
  });
});

describe('全データ削除', () => {
  it('AC-CORE-08: 全データ削除の後、すべてのテーブルが空になる', async () => {
    await populate();
    await wipeAll();
    for (const t of [...DATA_TABLES, 'ledger']) expect(await db.table(t).count()).toBe(0);
  });
});

describe('CSV', () => {
  it('AC-DATA-04: CSV の zip にテーブルごとのファイルがあり、各ファイルが BOM で始まる', async () => {
    await populate();
    const { bytes, fileName } = await exportCsvZip(NOW);
    expect(fileName).toBe('itte-csv-20261018.zip');
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(DATA_TABLES.map((t) => `${t}.csv`).sort());
    for (const content of Object.values(files)) expect([...content.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const habits = strFromU8(files['habits.csv']);
    expect(habits).toContain('\r\n');
    // 瞬間は ISO 8601、引用が必要な値はダブルクォートで囲む
    const measurements = parseCsv(strFromU8(files['measurements.csv']));
    expect(measurements[0]).toContain('measuredAt');
    const col = (name: string) => measurements[0].indexOf(name);
    const manual = measurements.find((r) => r[col('source')] === 'manual') ?? [];
    expect(manual[col('measuredAt')]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(manual[col('note')]).toBe('メモ, 引用"あり"');
    expect(strFromU8(files['measurements.csv'])).toContain('"メモ, 引用""あり"""');
  });

  it('AC-GOAL-22: CSV に全判定、全予想、全延長が含まれる', async () => {
    await populate();
    const files = unzipSync((await exportCsvZip(NOW)).bytes);
    const rows = (name: string) => parseCsv(strFromU8(files[name])).length - 1;
    expect(rows('judgments.csv')).toBe(await db.judgments.count());
    expect(rows('predictions.csv')).toBe(await db.predictions.count());
    expect(rows('deadlineExtensions.csv')).toBe(await db.deadlineExtensions.count());
    expect(rows('judgmentCorrections.csv')).toBe(1);
    const judgments = csvToRecords('judgments', strFromU8(files['judgments.csv']));
    expect(judgments).toEqual(await db.judgments.toArray());
  });

  it('AC-GOAL-23: 書き出した CSV を読み戻して、K1〜K4 の指標を再計算でき、ドメイン関数の結果と一致する', async () => {
    await populate();
    const files = unzipSync((await exportCsvZip(NOW)).bytes);
    const read = <T>(t: DataTableName) => csvToRecords(t, strFromU8(files[`${t}.csv`])) as T[];
    const from = {
      goals: read<Goal>('goals'),
      metrics: read<Metric>('metrics'),
      predictions: read<Prediction>('predictions'),
      judgments: read<Judgment>('judgments'),
      corrections: read<JudgmentCorrection>('judgmentCorrections'),
      followUps: read<GoalFollowUp>('goalFollowUps'),
      appOpens: read<AppOpen>('appOpens'),
    };
    const db_ = {
      goals: await db.goals.toArray(),
      metrics: await db.metrics.toArray(),
      predictions: await db.predictions.toArray(),
      judgments: await db.judgments.toArray(),
      corrections: await db.judgmentCorrections.toArray(),
      followUps: await db.goalFollowUps.toArray(),
      appOpens: await db.appOpens.toArray(),
    };
    const k = (d: typeof db_) => ({
      k1: calibrationError(calibrationSeries(d.judgments, d.goals, d.metrics, d.predictions, d.corrections)),
      k2: medianDelayHours(d.judgments),
      k3: usageRate(d.appOpens, '2026-10-12', '2026-10-18'),
      k4: kizamiRate(d.goals, d.judgments, d.followUps, NOW + 40 * DAY),
    });
    const fromCsv = k(from);
    expect(fromCsv).toEqual(k(db_));
    expect(fromCsv.k1).not.toBeNull();
    expect(fromCsv.k2).not.toBeNull();
  });
});

describe('.ics の取り込み', () => {
  it('盤面に予定として取り込み、同じ UID は2回目に飛ばす', async () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a@x', 'SUMMARY:ゼミ', 'DTSTART;VALUE=DATE:20261020', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    expect(await importIcs(ics, '2026-10-18', NOW)).toBe(1);
    expect(await importIcs(ics, '2026-10-18', NOW)).toBe(0);
    expect(await db.boardItems.toArray()).toMatchObject([{ type: 'event', title: 'ゼミ', dueDate: '2026-10-20', source: 'ics', externalUid: 'a@x' }]);
  });
});

describe('書き出し形式', () => {
  it('書き出し形式のテーブルは、Dexie のスキーマのテーブル（台帳を除く）と同じ', () => {
    expect([...DATA_TABLES].sort()).toEqual(Object.keys(SCHEMA_V1).filter((t) => t !== 'ledger').sort());
  });
});
