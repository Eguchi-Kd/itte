// 足踏みのフラグ1件（盤面・週次ふりかえりで使う）。規則の説明と「段を見る」「却下」
import { Link } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { dismissStallFlag } from '../../../db/repo/goals';
import { detectStalls, type StallSettings } from '../../../domain/goals/stall';
import type { EpochMs, Goal, StallFlag } from '../../../domain/types';
import type { GoalsData } from '../../../db/queries/goals';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';

/** 説明の {n}（延長回数・日数・連続の件数）を今のデータから求める。見つからなければ閾値 */
export function stallCount(flag: StallFlag, data: GoalsData, settings: StallSettings, now: EpochMs): number {
  const hit = detectStalls(
    { goals: data.goals, extensions: data.extensions, judgments: data.judgments, followUps: data.followUps },
    settings,
    now,
  ).find((h) => h.goalId === flag.goalId && h.rule === flag.rule);
  if (hit) return hit.n;
  return flag.rule === 'EXTENSION_3X'
    ? settings.stallExtensionThreshold
    : flag.rule === 'NO_FOLLOW_UP_30D'
      ? settings.stallFollowUpDays
      : settings.stallRepeatedUnmet;
}

export function StallCard({ flag, goal, n, extra }: { flag: StallFlag; goal: Goal; n: number; extra?: React.ReactNode }) {
  return (
    <Card data-testid={`stall-${flag.id}`}>
      <p className="text-body">{fill(ja.goals.stall[flag.rule], { n })}</p>
      <p className="mt-1 text-caption text-text-2">{goal.title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {extra}
        <Link to={`/goals/${goal.id}`} className="btn btn-secondary flex h-12 items-center px-3 text-label">
          {ja.goals.detail.viewGoal}
        </Link>
        <Button variant="ghost" onClick={() => void dismissStallFlag(flag.id, Date.now())}>
          {ja.goals.stall.dismiss}
        </Button>
      </div>
    </Card>
  );
}
