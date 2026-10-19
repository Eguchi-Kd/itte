// ラフ登録（§6.6.1、3ステップのレッスン）。実験の A 条件ではステップ1だけ
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { queryBoardItem, queryOpenGoals } from '../../../db/queries/start';
import { createTask } from '../../../db/repo/start';
import { addDays, logicalDate } from '../../../domain/dates';
import { validateTaskInput, type TaskInput } from '../../../domain/start/tasks';
import { Button } from '../../components/Button';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { LessonShell } from '../../components/LessonShell';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useFlags } from '../../hooks/useFlags';
import { useStartTask } from '../../hooks/useStartTask';

export default function TaskNew() {
  const [params] = useSearchParams();
  const boardItemId = params.get('boardItemId');
  const boardItem = useLiveQuery(async () => (boardItemId ? ((await queryBoardItem(boardItemId)) ?? null) : null), [boardItemId]);
  if (boardItemId && boardItem === undefined) return null;
  return <TaskLesson key={boardItem?.id ?? 'new'} initialTitle={boardItem?.title ?? ''} boardItemId={boardItem?.id ?? null} />;
}

function TaskLesson({ initialTitle, boardItemId }: { initialTitle: string; boardItemId: string | null }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const startOnly = params.get('start') === '1';
  const { roughStart } = useFlags();
  const startTask = useStartTask();
  const { notify } = useFeedback();
  const goals = useLiveQuery(() => queryOpenGoals(), []) ?? [];
  const today = logicalDate(Date.now());
  const total = roughStart ? 3 : 1;

  const [step, setStep] = useState(1);
  const [input, setInput] = useState<TaskInput>({
    title: initialTitle,
    roughVersion: '',
    firstAction: '',
    plannedFor: today,
    goalId: params.get('goalId'),
    boardItemId,
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<TaskInput>) => setInput((i) => ({ ...i, ...patch }));
  const errors = useMemo(() => validateTaskInput(input, roughStart), [input, roughStart]);

  const stepValid = step === 1 ? !errors.title : step === 2 ? !errors.roughVersion : !errors.firstAction && !errors.plannedFor;
  const last = step === total;
  const dirty = input.title !== initialTitle || !!input.roughVersion || !!input.firstAction;

  const save = async (start: boolean) => {
    setSaving(true);
    try {
      const task = await createTask(input, roughStart, Date.now());
      if (start) {
        await startTask(task.id);
      } else {
        notify({ type: 'saved' });
        navigate('/', { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const title = step === 1 ? ja.start.titleQ : step === 2 ? ja.start.roughQ : ja.start.firstQ;

  return (
    <LessonShell
      step={step}
      total={total}
      title={title}
      onClose={() => navigate('/', { replace: true })}
      dirty={dirty}
      primaryLabel={last ? ja.start.saveStart : ja.common.next}
      primaryVariant={last ? 'accent' : 'primary'}
      primaryDisabled={!stepValid || saving}
      onPrimary={() => (last ? void save(true) : setStep((s) => s + 1))}
      footer={
        last && !startOnly ? (
          <Button size="lg" block variant="secondary" disabled={!stepValid || saving} onClick={() => void save(false)}>
            {ja.start.save}
          </Button>
        ) : undefined
      }
    >
      {step === 1 && (
        <TextField label={ja.start.field.title} value={input.title} onChange={(v) => set({ title: v })} maxLength={80} testId="task-title" />
      )}
      {step === 2 && (
        <TextField
          label={ja.start.field.rough}
          hint={ja.start.roughHint}
          value={input.roughVersion ?? ''}
          onChange={(v) => set({ roughVersion: v })}
          maxLength={80}
          testId="task-rough"
        />
      )}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <TextField
            label={ja.start.field.first}
            hint={ja.start.firstHint}
            value={input.firstAction ?? ''}
            onChange={(v) => set({ firstAction: v })}
            maxLength={80}
            testId="task-first"
          />
          {goals.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-label">{ja.start.field.goalOptional}</span>
              <ChipGroup label={ja.start.field.goalOptional}>
                {goals.map((g) => (
                  <ChoiceChip key={g.id} selected={input.goalId === g.id} onToggle={() => set({ goalId: input.goalId === g.id ? null : g.id })}>
                    {g.title}
                  </ChoiceChip>
                ))}
              </ChipGroup>
            </div>
          )}
        </div>
      )}
      {last && <PlannedFor value={input.plannedFor} today={today} onChange={(d) => set({ plannedFor: d })} />}
    </LessonShell>
  );
}

function PlannedFor({ value, today, onChange }: { value: string; today: string; onChange: (d: string) => void }) {
  const tomorrow = addDays(today, 1);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label">{ja.start.field.planned}</span>
      <ChipGroup label={ja.start.field.planned}>
        <ChoiceChip selected={value === today} onToggle={() => onChange(today)}>
          {ja.start.today}
        </ChoiceChip>
        <ChoiceChip selected={value === tomorrow} onToggle={() => onChange(tomorrow)}>
          {ja.start.tomorrow}
        </ChoiceChip>
      </ChipGroup>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-text-2">{ja.start.field.plannedDate}</span>
        <input
          type="date"
          value={value}
          min={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-3 text-body"
        />
      </label>
    </div>
  );
}
