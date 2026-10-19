// 段の登録（#/goals/new）、刻む（#/goals/:id/kizami）、切り直す（#/goals/:id/recut）
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { queryGoal } from '../../../db/queries/goals';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GoalLesson, type GoalLessonMode } from './GoalLesson';

export default function GoalNew() {
  return <GoalLesson mode="new" base={null} />;
}

export function FollowUpLesson({ mode }: { mode: Exclude<GoalLessonMode, 'new'> }) {
  const { id = '' } = useParams();
  const goal = useLiveQuery(async () => (await queryGoal(id)) ?? null, [id]);
  if (goal === undefined) return null;
  // 元の段が届かなかった（UNMET）ときだけ入れる（I7、§6.8.5）
  if (!goal || goal.status !== 'UNMET') {
    return (
      <main className="flex flex-col gap-4 px-4" data-testid="followup-blocked">
        <ScreenHeader title={mode === 'kizami' ? ja.goals.kizamiTitle : ja.goals.recutTitle} fallback={goal ? `/goals/${goal.id}` : '/'} />
        <p className="text-body">{goal ? ja.errors.parentOpen : ja.goals.notFound}</p>
      </main>
    );
  }
  return <GoalLesson mode={mode} base={goal} />;
}
