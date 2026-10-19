// 逃避ログの入力（§6.6.7）。すべて任意で、全項目が空でも保存できる
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { queryRecentTasks } from '../../../db/queries/start';
import { saveEscapeLog } from '../../../db/repo/start';
import { addDays, logicalDate } from '../../../domain/dates';
import type { Enjoyed, EscapeTarget, ID, PriorState } from '../../../domain/types';
import { Button } from '../../components/Button';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { useFeedback } from '../../feedback/FeedbackProvider';

interface Props {
  /** 放置セッションから促された場合のセッション */
  sessionId: ID | null;
  taskId?: ID | null;
  onDone: () => void;
}

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label">{label}</span>
      <ChipGroup label={label}>
        {options.map(([v, text]) => (
          <ChoiceChip key={v} selected={value === v} onToggle={() => onChange(value === v ? null : v)}>
            {text}
          </ChoiceChip>
        ))}
      </ChipGroup>
    </div>
  );
}

const PRIOR = [
  ['anxiety', ja.start.anxiety],
  ['fatigue', ja.start.fatigue],
  ['ambiguity', ja.start.ambiguity],
  ['boredom', ja.start.boredom],
] as const;
const TARGET = [
  ['video', ja.start.video],
  ['game', ja.start.game],
  ['sleep', ja.start.sleep],
  ['other', ja.start.other],
] as const;
const ENJOYED = [
  ['yes', ja.start.yes],
  ['no', ja.start.no],
  ['partly', ja.start.partly],
] as const;

export function EscapeForm({ sessionId, taskId = null, onDone }: Props) {
  const { notify } = useFeedback();
  const today = logicalDate(Date.now());
  const tasks = useLiveQuery(() => queryRecentTasks(today, addDays(today, -1)), [today]) ?? [];
  const [priorState, setPrior] = useState<PriorState | null>(null);
  const [target, setTarget] = useState<EscapeTarget | null>(null);
  const [enjoyed, setEnjoyed] = useState<Enjoyed | null>(null);
  const [task, setTask] = useState<ID | null>(taskId);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-5" data-testid="escape-form">
      <Chips label={ja.start.priorQ} options={PRIOR} value={priorState} onChange={setPrior} />
      <Chips label={ja.start.targetQ} options={TARGET} value={target} onChange={setTarget} />
      <Chips label={ja.start.enjoyedQ} options={ENJOYED} value={enjoyed} onChange={setEnjoyed} />
      {tasks.length > 0 && (
        <Chips
          label={ja.start.escape.related}
          options={tasks.map((t) => [t.id, t.title] as const)}
          value={task}
          onChange={setTask}
        />
      )}
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          block
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await saveEscapeLog({ priorState, target, enjoyed, taskId: task, sessionId }, Date.now());
              notify({ type: 'escape' });
              onDone();
            } finally {
              setBusy(false);
            }
          }}
        >
          {ja.start.escape.record}
        </Button>
        <Button size="lg" block variant="ghost" onClick={onDone}>
          {ja.common.skip}
        </Button>
      </div>
    </div>
  );
}
