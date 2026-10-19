// 判定の履歴（§6.8.8）。未達も含む全判定を新しい順に。削除はできず、絞り込みと訂正の追記だけ
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { copyByKey, fill } from '../../../copy/fill';
import { queryGoalsData } from '../../../db/queries/goals';
import { correctJudgment } from '../../../db/repo/goals';
import { logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { isDomainError } from '../../../domain/errors';
import { effectiveValue } from '../../../domain/goals/judgment';
import type { ID, Judgment, JudgmentOutcome } from '../../../domain/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';

export default function JudgmentHistory() {
  const data = useLiveQuery(() => queryGoalsData(), []);
  const [outcome, setOutcome] = useState<JudgmentOutcome | null>(null);
  const [metricId, setMetricId] = useState<ID | null>(null);
  const [editing, setEditing] = useState<{ id: ID; kind: 'value' | 'note' } | null>(null);
  if (!data) return null;
  const goalById = new Map(data.goals.map((g) => [g.id, g]));
  const metricById = new Map(data.metrics.map((m) => [m.id, m]));
  const rows = [...data.judgments]
    .sort((a, b) => b.judgedAt - a.judgedAt)
    .filter((j) => (outcome ? j.outcome === outcome : true))
    .filter((j) => (metricId ? goalById.get(j.goalId)?.metricId === metricId : true));

  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="judgment-history">
      <ScreenHeader title={ja.goals.history.title} fallback="/library" />
      <ChipGroup label={ja.goals.history.outcomeFilter}>
        <ChoiceChip selected={outcome === null} onToggle={() => setOutcome(null)}>
          {ja.goals.history.all}
        </ChoiceChip>
        <ChoiceChip selected={outcome === 'MET'} onToggle={() => setOutcome('MET')}>
          {ja.goals.met}
        </ChoiceChip>
        <ChoiceChip selected={outcome === 'UNMET'} onToggle={() => setOutcome('UNMET')}>
          {ja.goals.unmet}
        </ChoiceChip>
      </ChipGroup>
      {data.metrics.length > 1 && (
        <ChipGroup label={ja.goals.history.metricFilter}>
          <ChoiceChip selected={metricId === null} onToggle={() => setMetricId(null)}>
            {ja.goals.history.all}
          </ChoiceChip>
          {data.metrics.map((m) => (
            <ChoiceChip key={m.id} selected={metricId === m.id} onToggle={() => setMetricId(m.id)}>
              {m.name}
            </ChoiceChip>
          ))}
        </ChipGroup>
      )}
      {rows.length === 0 && <p className="text-caption text-text-2">{ja.goals.history.empty}</p>}
      {rows.map((j) => {
        const g = goalById.get(j.goalId);
        const m = g ? metricById.get(g.metricId) : undefined;
        const cs = data.corrections.filter((c) => c.judgmentId === j.id);
        return (
          <Card key={j.id} data-testid={`judgment-${j.id}`}>
            <p className="text-body">{g?.title}</p>
            <p className="text-caption text-text-2">
              {fill(ja.goals.detail.judgmentRow, {
                date: formatDateShort(logicalDate(j.judgedAt)),
                outcome: j.outcome === 'MET' ? ja.goals.met : ja.goals.unmet,
                value: effectiveValue(j, cs, 'actualValue') ?? j.actualValue,
                unit: m?.unit ?? '',
              })}
              {cs.length > 0 && ` ${ja.goals.history.corrected}`}
            </p>
            {editing?.id === j.id ? (
              <CorrectionForm judgment={j} kind={editing.kind} onDone={() => setEditing(null)} />
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing({ id: j.id, kind: 'value' })}>
                  {ja.goals.history.correctValue}
                </Button>
                {j.outcome === 'UNMET' && (
                  <Button size="sm" variant="secondary" onClick={() => setEditing({ id: j.id, kind: 'note' })}>
                    {ja.goals.history.correctNote}
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </main>
  );
}

function CorrectionForm({ judgment, kind, onDone }: { judgment: Judgment; kind: 'value' | 'note'; onDone: () => void }) {
  const { notify } = useFeedback();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const num = Number(value);
  const valid = reason.trim().length > 0 && (kind === 'value' ? value.trim() !== '' && Number.isFinite(num) : value.trim().length > 0);
  return (
    <div className="mt-3 flex flex-col gap-3" data-testid="correction-form">
      <TextField
        label={kind === 'value' ? ja.goals.history.newValue : ja.goals.history.newNote}
        value={value}
        onChange={setValue}
        maxLength={kind === 'value' ? 20 : 200}
      />
      <TextField label={ja.goals.reasonQ} value={reason} onChange={setReason} maxLength={200} />
      {error && (
        <p role="alert" className="text-body">
          {error}
        </p>
      )}
      <Button
        disabled={!valid}
        onClick={async () => {
          try {
            await correctJudgment(judgment.id, kind === 'value' ? 'actualValue' : 'costNote', kind === 'value' ? num : value, reason, Date.now());
            notify({ type: 'saved' });
            onDone();
          } catch (e) {
            setError(copyByKey(isDomainError(e) ? e.copyKey : 'errors.unknown'));
          }
        }}
      >
        {ja.goals.history.save}
      </Button>
    </div>
  );
}
