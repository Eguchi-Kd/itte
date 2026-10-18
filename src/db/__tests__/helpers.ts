import type { HabitDraft } from '../../domain/habits/validate';
import type { ImmutableTable, Settings } from '../../domain/types';
import { db } from '../db';
import { updateSettings } from '../repo/common';
import { ensureSeed } from '../seed';

export const NOW = new Date(2026, 9, 18, 12, 0, 0).getTime();

export async function resetDb(): Promise<void> {
  db.close();
  await db.delete();
  await db.open();
}

/** DB を作り直して初期データを入れる。settings を渡すと上書きする */
export async function resetSeeded(settings: Partial<Omit<Settings, 'id'>> = {}): Promise<void> {
  await resetDb();
  await ensureSeed(NOW);
  if (Object.keys(settings).length) await updateSettings(settings, NOW);
}

/** Dexie が包んだエラーも含めて DomainError のコードを取り出す */
export function errorCode(e: unknown): string | undefined {
  const x = e as { code?: string; inner?: unknown; failures?: unknown[] } | undefined;
  if (!x) return undefined;
  if (typeof x.code === 'string') return x.code;
  if (x.inner) return errorCode(x.inner);
  if (x.failures?.length) return errorCode(x.failures[0]);
  return undefined;
}

export async function codeOfRejection(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return errorCode(e);
  }
  return 'RESOLVED';
}

/** 追記専用の9テーブルそれぞれの見本レコード */
export function sampleRecords(): Record<ImmutableTable, Record<string, unknown>> {
  return {
    measurements: { id: 'm1', metricId: 'mt1', value: 3, measuredAt: NOW, source: 'manual', note: null, createdAt: NOW },
    predictions: {
      id: 'p1',
      goalId: 'g1',
      kind: 'OUTCOME',
      value: { probability: 60, value: 3 },
      predictedAt: NOW,
      sessionId: null,
    },
    affectActuals: { id: 'a1', predictionId: 'p1', intensity: 4, durationMin: 10, at: NOW },
    commitments: { id: 'c1', goalId: 'g1', condition: 'ON_MET', nextAction: '次の段を立てる', createdAt: NOW },
    judgmentRequests: { goalId: 'g1', requestedAt: NOW, detectedAt: NOW },
    judgments: {
      id: 'j1',
      goalId: 'g1',
      outcome: 'UNMET',
      actualValue: 2,
      investedHours: 5,
      costNote: '週末',
      requestedAt: NOW,
      detectedAt: NOW,
      judgedAt: NOW,
      enforced: true,
    },
    judgmentCorrections: {
      id: 'jc1',
      judgmentId: 'j1',
      field: 'actualValue',
      newValue: 3,
      reason: '数え間違い',
      createdAt: NOW,
    },
    deadlineExtensions: {
      id: 'd1',
      goalId: 'g1',
      previousDeadline: '2026-10-20',
      newDeadline: '2026-10-27',
      reason: '体調',
      createdAt: NOW,
    },
    goalFollowUps: { id: 'f1', goalId: 'g1', choice: 'KIZAMI', createdAt: NOW },
  };
}

export function habitDraft(p: Partial<HabitDraft> = {}): HabitDraft {
  return {
    kind: 'build',
    name: '英単語',
    replacesText: null,
    purpose: '',
    unit: '分',
    amount: 10,
    minAmount: 2,
    schedule: { days: [0, 1, 2, 3, 4, 5, 6], time: '07:00', cue: null },
    place: '机',
    how: '',
    commitmentNote: null,
    funNote: null,
    ...p,
  };
}
