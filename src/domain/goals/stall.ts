// 足踏みの検出（§8.7.5）【刻】。検出はフラグの提示までで、ペナルティや強制はしない
import type { DeadlineExtension, EpochMs, Goal, GoalFollowUp, ID, Judgment, Settings, StallRule } from '../types';

const DAY = 86_400_000;

export interface StallInput {
  goals: readonly Goal[];
  extensions: readonly DeadlineExtension[];
  judgments: readonly Judgment[];
  followUps: readonly GoalFollowUp[];
}

export type StallSettings = Pick<Settings, 'stallExtensionThreshold' | 'stallFollowUpDays' | 'stallRepeatedUnmet'>;

export interface StallHit {
  goalId: ID;
  rule: StallRule;
  /** 説明の {n} に入れる数（延長回数、経過日数、連続の件数） */
  n: number;
}

export function detectStalls(input: StallInput, settings: StallSettings, now: EpochMs): StallHit[] {
  const out: StallHit[] = [];
  const judgmentOf = new Map(input.judgments.map((j) => [j.goalId, j]));
  const followOf = new Map(input.followUps.map((f) => [f.goalId, f]));
  const byId = new Map(input.goals.map((g) => [g.id, g]));

  for (const g of input.goals) {
    // EXTENSION_3X: 延長の件数が閾値以上で、MET でない
    const ext = input.extensions.filter((e) => e.goalId === g.id).length;
    if (ext >= settings.stallExtensionThreshold && g.status !== 'MET') out.push({ goalId: g.id, rule: 'EXTENSION_3X', n: ext });

    // NO_FOLLOW_UP_30D: UNMET の判定から N 日以上、取り下げでなく、N 日以内に子も切り直しもない
    const j = judgmentOf.get(g.id);
    if (g.status === 'UNMET' && j) {
      const limit = settings.stallFollowUpDays * DAY;
      const withdrawn = followOf.get(g.id)?.choice === 'WITHDRAW';
      const followed = input.goals.some(
        (x) => (x.parentId === g.id || x.recutOfId === g.id) && x.createdAt <= j.judgedAt + limit,
      );
      if (now - j.judgedAt >= limit && !withdrawn && !followed) {
        out.push({ goalId: g.id, rule: 'NO_FOLLOW_UP_30D', n: Math.floor((now - j.judgedAt) / DAY) });
      }
    }
  }

  // REPEATED_UNMET_3X: recutOfId の鎖の最新の段から、その段を含めて連続 N 件が UNMET
  const recutChildren = new Set(input.goals.map((g) => g.recutOfId).filter((x): x is ID => x !== null));
  for (const tip of input.goals.filter((g) => !recutChildren.has(g.id))) {
    let run = 0;
    let cur: Goal | undefined = tip;
    const seen = new Set<ID>();
    while (cur && cur.status === 'UNMET' && !seen.has(cur.id)) {
      seen.add(cur.id);
      run += 1;
      cur = cur.recutOfId ? byId.get(cur.recutOfId) : undefined;
    }
    if (run >= settings.stallRepeatedUnmet) out.push({ goalId: tip.id, rule: 'REPEATED_UNMET_3X', n: run });
  }
  return out;
}
