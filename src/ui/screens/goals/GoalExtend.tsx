// 期限の延長（§6.8.6）。期限日を過ぎた段には出さない（D34）
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { copyByKey, fill } from '../../../copy/fill';
import { queryGoal } from '../../../db/queries/goals';
import { extendDeadline } from '../../../db/repo/goals';
import { addDays, logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { isDomainError } from '../../../domain/errors';
import { Button } from '../../components/Button';
import { DateChips } from '../../components/DateChips';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';

export default function GoalExtend() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const goal = useLiveQuery(async () => (await queryGoal(id)) ?? null, [id]);
  const [deadline, setDeadline] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (goal === undefined) return null;
  const today = logicalDate(Date.now());
  const back = goal ? `/goals/${goal.id}` : '/';
  if (!goal || goal.status !== 'OPEN' || today > goal.deadline) {
    return (
      <main className="flex flex-col gap-4 px-4" data-testid="extend-blocked">
        <ScreenHeader title={ja.goals.extendForm.title} fallback={back} />
        <p className="text-body">{goal ? ja.errors.extendPast : ja.goals.notFound}</p>
      </main>
    );
  }
  const valid = deadline > goal.deadline && reason.trim().length > 0;
  return (
    <main className="flex flex-col gap-5 px-4 pb-8" data-testid="goal-extend">
      <ScreenHeader title={ja.goals.extendForm.title} fallback={back} />
      <p className="text-body">{goal.title}</p>
      <p className="text-caption text-text-2">{fill(ja.goals.extendForm.current, { date: formatDateShort(goal.deadline) })}</p>
      <DateChips label={ja.goals.extendForm.newDeadline} value={deadline} onChange={setDeadline} today={today} min={addDays(goal.deadline, 1)} />
      <TextField label={ja.goals.reasonQ} value={reason} onChange={setReason} maxLength={200} />
      {error && (
        <p role="alert" className="text-body">
          {error}
        </p>
      )}
      <Button
        size="lg"
        block
        disabled={!valid}
        onClick={async () => {
          try {
            await extendDeadline(goal.id, deadline, reason, today, Date.now());
            notify({ type: 'saved' });
            navigate(back, { replace: true });
          } catch (e) {
            setError(copyByKey(isDomainError(e) ? e.copyKey : 'errors.unknown'));
          }
        }}
      >
        {ja.goals.extendForm.save}
      </Button>
    </main>
  );
}
