import type { Goal, Judgment, JudgmentCorrection, Metric, Prediction } from '../types';

export const NOW = new Date(2026, 9, 18, 12, 0).getTime();
export const DAY = 86_400_000;

export function goal(p: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    parentId: null,
    recutOfId: null,
    metricId: 'm1',
    title: '章を3つ書く',
    targetValue: 3,
    comparator: 'GTE',
    deadline: '2026-10-15',
    status: 'OPEN',
    createdAt: NOW - 30 * DAY,
    hiddenAt: null,
    ...p,
  };
}

export function metric(p: Partial<Metric> = {}): Metric {
  return {
    id: 'm1',
    name: '書いた章数',
    unit: '章',
    direction: 'HIGHER_IS_BETTER',
    collectionMethod: 'ファイルを数える',
    verifiable: true,
    createdAt: 0,
    ...p,
  };
}

export function judgment(p: Partial<Judgment> = {}): Judgment {
  return {
    id: 'j1',
    goalId: 'g1',
    outcome: 'UNMET',
    actualValue: 2,
    investedHours: 10,
    costNote: '週末',
    requestedAt: NOW - 3 * DAY,
    detectedAt: NOW - 3 * DAY,
    judgedAt: NOW - 2 * DAY,
    enforced: true,
    ...p,
  };
}

export function outcomePrediction(p: Omit<Partial<Prediction>, 'value'> & { probability?: number; value?: number } = {}): Prediction {
  const { probability = 60, value = 4, ...rest } = p;
  return {
    id: 'p1',
    goalId: 'g1',
    kind: 'OUTCOME',
    value: { probability, value },
    predictedAt: NOW - 30 * DAY,
    sessionId: null,
    ...rest,
  };
}

export function correction(p: Partial<JudgmentCorrection> = {}): JudgmentCorrection {
  return {
    id: 'c1',
    judgmentId: 'j1',
    field: 'actualValue',
    newValue: 3,
    reason: '数え間違い',
    createdAt: NOW - DAY,
    ...p,
  };
}
