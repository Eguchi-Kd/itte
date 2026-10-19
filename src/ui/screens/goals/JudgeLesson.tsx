// 判定（§6.8.4、レッスン）。届いた／届かなかったで、色・音・動き・コマの有無を変えない（§2.2）
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { copyByKey, fill } from '../../../copy/fill';
import { queryGoalsData } from '../../../db/queries/goals';
import { chooseFollowUp, judge } from '../../../db/repo/goals';
import { logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { isDomainError } from '../../../domain/errors';
import { computeOutcome, unmetDetailValid } from '../../../domain/goals/judgment';
import type { FollowUpChoice, Goal, JudgmentOutcome, Metric } from '../../../domain/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CheckSheet } from '../../components/CheckSheet';
import { LessonShell } from '../../components/LessonShell';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useFlags } from '../../hooks/useFlags';
import { goalSentence } from './GoalLesson';

const TOTAL = 4;
type Phase = 'input' | 'unmet' | 'follow' | 'done';

export default function JudgeLesson() {
  const { goalId = '' } = useParams();
  const data = useLiveQuery(() => queryGoalsData(), []);
  if (!data) return null;
  const goal = data.goals.find((g) => g.id === goalId);
  const metric = goal ? data.metrics.find((m) => m.id === goal.metricId) : undefined;
  if (!goal || !metric) {
    return (
      <main className="flex flex-col gap-4 px-4">
        <ScreenHeader title={ja.goals.judge.title} fallback="/" />
        <p className="text-body">{ja.goals.notFound}</p>
      </main>
    );
  }
  const judgment = data.judgments.find((j) => j.goalId === goal.id) ?? null;
  const followUp = data.followUps.find((f) => f.goalId === goal.id) ?? null;
  const initial: Phase = judgment ? (judgment.outcome === 'UNMET' && !followUp ? 'follow' : 'done') : 'input';
  const commitments = data.commitments.filter((c) => c.goalId === goal.id);
  const latest = data.measurements.filter((m) => m.metricId === metric.id).sort((a, b) => b.measuredAt - a.measuredAt)[0] ?? null;
  return (
    <Judge
      key={goal.id}
      goal={goal}
      metric={metric}
      initial={initial}
      initialOutcome={judgment?.outcome ?? null}
      onMet={commitments.find((c) => c.condition === 'ON_MET')?.nextAction ?? ''}
      onUnmet={commitments.find((c) => c.condition === 'ON_UNMET')?.nextAction ?? ''}
      latest={latest ? fill(ja.goals.latest, { value: `${latest.value}${metric.unit}`, date: formatDateShort(logicalDate(latest.measuredAt)) }) : null}
    />
  );
}

interface Props {
  goal: Goal;
  metric: Metric;
  initial: Phase;
  initialOutcome: JudgmentOutcome | null;
  onMet: string;
  onUnmet: string;
  latest: string | null;
}

function Judge({ goal, metric, initial, initialOutcome, onMet, onUnmet, latest }: Props) {
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const { judgmentEnforced } = useFlags();
  const [phase, setPhase] = useState<Phase>(initial);
  const [actual, setActual] = useState('');
  const [checking, setChecking] = useState(false);
  const [hours, setHours] = useState('');
  const [cost, setCost] = useState('');
  const [outcome, setOutcome] = useState<JudgmentOutcome | null>(initialOutcome);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = logicalDate(Date.now());

  if (initial === 'input' && goal.deadline >= today) {
    return (
      <main className="flex flex-col gap-4 px-4" data-testid="judge-not-due">
        <ScreenHeader title={ja.goals.judge.title} fallback={`/goals/${goal.id}`} />
        <p className="text-body">{ja.errors.notDue}</p>
      </main>
    );
  }

  const value = actual.trim() === '' ? Number.NaN : Number(actual);
  const computed = Number.isFinite(value) ? computeOutcome(goal.comparator, goal.targetValue, value) : null;
  const sentence = goalSentence(metric, goal.comparator, goal.targetValue);
  const unmetDetail = { investedHours: hours.trim() === '' ? null : Number(hours), costNote: cost };

  const record = async (detail: typeof unmetDetail | null) => {
    setBusy(true);
    setError(null);
    try {
      const j = await judge(goal.id, value, detail, { enforced: judgmentEnforced }, Date.now());
      setOutcome(j.outcome);
      notify({ type: 'judgment', outcome: j.outcome });
      setPhase(j.outcome === 'UNMET' ? 'follow' : 'done');
    } catch (e) {
      setError(copyByKey(isDomainError(e) ? e.copyKey : 'errors.unknown'));
    } finally {
      setBusy(false);
      setChecking(false);
    }
  };

  const follow = async (choice: FollowUpChoice) => {
    setBusy(true);
    try {
      await chooseFollowUp(goal.id, choice, Date.now());
      if (choice === 'KIZAMI') navigate(`/goals/${goal.id}/kizami`, { replace: true });
      else if (choice === 'RECUT') navigate(`/goals/${goal.id}/recut`, { replace: true });
      else setPhase('done');
    } finally {
      setBusy(false);
    }
  };

  const step = phase === 'input' ? 1 : phase === 'unmet' ? 3 : phase === 'follow' ? 4 : TOTAL;
  const title =
    phase === 'input'
      ? goal.title
      : phase === 'unmet'
        ? ja.goals.hoursQ
        : phase === 'follow'
          ? ja.goals.followQ
          : ja.goals.judge.done;

  return (
    <LessonShell
      step={step}
      intro={step === 1 ? 'judge' : undefined}
      total={TOTAL}
      title={title}
      onClose={() => navigate('/', { replace: true })}
      primaryLabel={phase === 'input' ? ja.common.check : phase === 'unmet' ? ja.common.confirm : undefined}
      primaryDisabled={busy || (phase === 'input' ? computed === null : phase === 'unmet' ? !unmetDetailValid(unmetDetail) : true)}
      onPrimary={() => (phase === 'input' ? setChecking(true) : void record(unmetDetail))}
    >
      {phase === 'input' && (
        <div className="flex flex-col gap-4">
          {/* 決めておいたことを、実測の入力欄より前に出す（DOM の順も同じ。AC-GOAL-13） */}
          <section aria-label={ja.goals.detail.commitments} className="flex flex-col gap-2" data-testid="judge-commitments">
            <Card>
              <p className="text-caption text-text-2">{ja.goals.judge.commitMet}</p>
              <p className="text-body">{onMet}</p>
            </Card>
            <Card>
              <p className="text-caption text-text-2">{ja.goals.judge.commitUnmet}</p>
              <p className="text-body">{onUnmet}</p>
            </Card>
          </section>
          <p className="text-body">{sentence}</p>
          <TextField label={ja.goals.actualQ} value={actual} onChange={setActual} maxLength={20} testId="judge-actual" />
          {latest && <p className="text-caption text-text-2">{latest}</p>}
        </div>
      )}
      {phase === 'unmet' && (
        <div className="flex flex-col gap-4">
          <TextField label={`${ja.goals.hoursQ}（${ja.goals.judge.hours}）`} value={hours} onChange={setHours} maxLength={10} testId="judge-hours" />
          <TextField label={ja.goals.costQ} value={cost} onChange={setCost} maxLength={200} testId="judge-cost" />
        </div>
      )}
      {phase === 'follow' && (
        <div className="flex flex-col gap-3" role="group" aria-label={ja.goals.followQ}>
          {(['KIZAMI', 'RECUT', 'WITHDRAW'] as const).map((c) => (
            <Button key={c} size="lg" block variant="secondary" disabled={busy} onClick={() => void follow(c)}>
              {ja.goals.followChoice[c]}
            </Button>
          ))}
        </div>
      )}
      {phase === 'done' && (
        <div className="flex flex-col gap-3" data-testid="judge-done">
          <Card>
            <p className="text-caption text-text-2">{ja.goals.judge.nextAction}</p>
            <p className="text-h2">{outcome === 'MET' ? onMet : onUnmet}</p>
          </Card>
          {outcome === 'MET' && (
            <Button size="lg" block onClick={() => navigate('/goals/new', { replace: true })}>
              {ja.goals.nextLevel}
            </Button>
          )}
          <Button size="lg" block variant="secondary" onClick={() => navigate('/', { replace: true })}>
            {ja.goals.judge.later}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-body">
          {error}
        </p>
      )}
      <CheckSheet
        open={checking}
        title={ja.goals.irreversibleNote}
        busy={busy}
        onFix={() => setChecking(false)}
        onConfirm={() => {
          if (computed === 'UNMET') {
            setChecking(false);
            setPhase('unmet');
          } else {
            void record(null);
          }
        }}
      >
        {computed && (
          <p className="text-h2" data-testid="judge-check-line">
            {fill(ja.goals.judge.checkLine, {
              value: actual.trim(),
              unit: metric.unit,
              target: goal.targetValue,
              cmp: ja.goals.comparators[goal.comparator],
              result: computed === 'MET' ? ja.goals.met : ja.goals.unmet,
            })}
          </p>
        )}
      </CheckSheet>
    </LessonShell>
  );
}
