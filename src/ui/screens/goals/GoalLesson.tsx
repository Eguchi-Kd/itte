// 段の登録（§6.8.1、5ステップ＋確認）と、刻む・切り直す（§6.8.5）。途中保存はしない
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { copyByKey, fill } from '../../../copy/fill';
import { queryMetrics } from '../../../db/queries/goals';
import { createChildGoal, createGoal, createRecutGoal, saveMetric } from '../../../db/repo/goals';
import { logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { isDomainError } from '../../../domain/errors';
import { defaultComparator, goalInputErrors, metricInputSchema, type GoalInput, type MetricInput } from '../../../domain/goals/goal';
import type { Comparator, Direction, Goal, Metric } from '../../../domain/types';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { DateChips } from '../../components/DateChips';
import { LessonShell } from '../../components/LessonShell';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useFeedback } from '../../feedback/FeedbackProvider';

export type GoalLessonMode = 'new' | 'kizami' | 'recut';

const TOTAL = 6;
const PROBABILITIES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/** 「{指標}が {値}{単位} 以上」 */
export function goalSentence(metric: Pick<Metric, 'name' | 'unit'>, comparator: Comparator, value: number | string): string {
  return fill(comparator === 'GTE' ? ja.goals.gte : ja.goals.lte, { metric: metric.name, value, unit: metric.unit });
}

const toNumber = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function GoalLesson({ mode, base }: { mode: GoalLessonMode; base: Goal | null }) {
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const metrics = useLiveQuery(() => queryMetrics(), []);
  const today = logicalDate(Date.now());
  const [step, setStep] = useState(1);
  const [metricId, setMetricId] = useState<string | 'new' | null>(base?.metricId ?? null);
  const [newMetric, setNewMetric] = useState<MetricInput>({
    name: '',
    unit: '',
    direction: 'HIGHER_IS_BETTER',
    collectionMethod: '',
    verifiable: false,
  });
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [comparator, setComparator] = useState<Comparator | null>(base?.comparator ?? null);
  const [deadline, setDeadline] = useState('');
  const [onMet, setOnMet] = useState('');
  const [onUnmet, setOnUnmet] = useState('');
  const [probability, setProbability] = useState<number | null>(null);
  const [predicted, setPredicted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosenMetric: Pick<Metric, 'name' | 'unit' | 'direction'> | null = useMemo(() => {
    if (metricId === 'new') return newMetric;
    return metrics?.find((m) => m.id === metricId) ?? null;
  }, [metricId, newMetric, metrics]);

  if (!metrics) return null;

  const direction: Direction = chosenMetric?.direction ?? 'HIGHER_IS_BETTER';
  const cmp = comparator ?? defaultComparator(direction);
  const input: GoalInput = {
    metricId: metricId && metricId !== 'new' ? metricId : 'pending',
    title,
    targetValue: toNumber(target) ?? Number.NaN,
    comparator: cmp,
    deadline,
    onMet,
    onUnmet,
    probability: probability ?? Number.NaN,
    predictedValue: toNumber(predicted) ?? Number.NaN,
  };
  const errs = goalInputErrors(input, today);
  const valid =
    step === 1
      ? metricId === 'new'
        ? metricInputSchema.safeParse(newMetric).success
        : metricId !== null
      : step === 2
        ? !errs.includes('title') && !errs.includes('targetValue')
        : step === 3
          ? !errs.includes('deadline')
          : step === 4
            ? !errs.includes('onMet') && !errs.includes('onUnmet')
            : step === 5
              ? !errs.includes('probability') && !errs.includes('predictedValue')
              : errs.filter((e) => e !== 'metricId').length === 0;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const now = Date.now();
      const id = metricId === 'new' ? (await saveMetric(newMetric, now)).id : (metricId as string);
      const goalInput = { ...input, metricId: id };
      const g =
        mode === 'kizami' && base
          ? await createChildGoal(base.id, goalInput, now)
          : mode === 'recut' && base
            ? await createRecutGoal(base.id, goalInput, now)
            : await createGoal(goalInput, now);
      notify({ type: 'saved' });
      navigate(`/goals/${g.id}`, { replace: true });
    } catch (e) {
      setError(copyByKey(isDomainError(e) ? e.copyKey : 'errors.unknown'));
    } finally {
      setBusy(false);
    }
  };

  const titles = [ja.goals.metricQ, ja.goals.levelQ, ja.goals.deadlineQ, ja.goals.commitQ, ja.goals.predictQ, ja.goals.create];
  const sentence = chosenMetric ? goalSentence(chosenMetric, cmp, target) : '';
  const band = base ? fill(ja.goals.parentBand, { title: base.title }) : undefined;

  return (
    <LessonShell
      step={step}
      total={TOTAL}
      title={titles[step - 1]}
      band={band}
      onClose={() => navigate(base ? `/goals/${base.id}` : '/', { replace: true })}
      dirty={metricId !== null || title.length > 0}
      primaryLabel={step === TOTAL ? ja.goals.create : ja.common.next}
      primaryDisabled={!valid || busy}
      onPrimary={() => (step === TOTAL ? void save() : setStep(step + 1))}
    >
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <ChipGroup label={ja.goals.metricQ}>
            {metrics.map((m) => (
              <ChoiceChip key={m.id} selected={metricId === m.id} onToggle={() => setMetricId(m.id)}>
                {m.name}
              </ChoiceChip>
            ))}
            <ChoiceChip selected={metricId === 'new'} onToggle={() => setMetricId('new')}>
              {ja.goals.newMetric}
            </ChoiceChip>
          </ChipGroup>
          {metricId === 'new' && (
            <div className="flex flex-col gap-3" data-testid="new-metric">
              <TextField label={ja.goals.field.metricName} value={newMetric.name} onChange={(v) => setNewMetric({ ...newMetric, name: v })} maxLength={40} />
              <TextField label={ja.goals.field.unit} value={newMetric.unit} onChange={(v) => setNewMetric({ ...newMetric, unit: v })} maxLength={10} />
              <ChipGroup label={ja.goals.field.direction}>
                {(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER'] as const).map((d) => (
                  <ChoiceChip key={d} selected={newMetric.direction === d} onToggle={() => setNewMetric({ ...newMetric, direction: d })}>
                    {d === 'HIGHER_IS_BETTER' ? ja.goals.higher : ja.goals.lower}
                  </ChoiceChip>
                ))}
              </ChipGroup>
              <TextField
                label={ja.goals.collection}
                value={newMetric.collectionMethod}
                onChange={(v) => setNewMetric({ ...newMetric, collectionMethod: v })}
                maxLength={200}
              />
              <Toggle label={ja.goals.verifiable} checked={newMetric.verifiable} onChange={(v) => setNewMetric({ ...newMetric, verifiable: v })} />
            </div>
          )}
          <p className="text-caption text-text-2">{ja.goals.luckNote}</p>
        </div>
      )}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <TextField label={ja.goals.field.title} value={title} onChange={setTitle} maxLength={80} />
          <TextField label={ja.goals.field.target} value={target} onChange={setTarget} maxLength={20} />
          <ChipGroup label={ja.goals.field.comparator}>
            {(['GTE', 'LTE'] as const).map((c) => (
              <ChoiceChip key={c} selected={cmp === c} onToggle={() => setComparator(c)}>
                {ja.goals.comparators[c]}
              </ChoiceChip>
            ))}
          </ChipGroup>
          {chosenMetric && <p className="text-h2" data-testid="goal-preview">{sentence}</p>}
        </div>
      )}
      {step === 3 && <DateChips label={ja.goals.field.deadline} value={deadline} onChange={setDeadline} today={today} />}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <p className="text-caption text-text-2">{ja.goals.commitHint}</p>
          <TextField label={ja.goals.onMet} value={onMet} onChange={setOnMet} maxLength={80} />
          <TextField label={ja.goals.onUnmet} value={onUnmet} onChange={setOnUnmet} maxLength={80} />
        </div>
      )}
      {step === 5 && (
        <div className="flex flex-col gap-4">
          <span className="text-label">{ja.goals.probability}</span>
          <ChipGroup label={ja.goals.probability}>
            {PROBABILITIES.map((p) => (
              <ChoiceChip key={p} selected={probability === p} onToggle={() => setProbability(p)}>
                {fill(ja.goals.probabilityChip, { n: p })}
              </ChoiceChip>
            ))}
          </ChipGroup>
          <TextField label={ja.goals.predictedValue} value={predicted} onChange={setPredicted} maxLength={20} />
        </div>
      )}
      {step === 6 && (
        <>
          <p className="text-display" data-testid="goal-confirm">
            {fill(ja.goals.confirmLine, { deadline: deadline ? formatDateShort(deadline) : '', sentence })}
          </p>
          {error && (
            <p role="alert" className="text-body">
              {error}
            </p>
          )}
        </>
      )}
    </LessonShell>
  );
}
