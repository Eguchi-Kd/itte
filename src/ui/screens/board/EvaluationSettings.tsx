// 評価関数（§6.7.2）。避けたいことは最大3つで、4つ目の入力欄は出さない
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { copyByKey, fill } from '../../../copy/fill';
import { queryBoardData } from '../../../db/queries/board';
import { saveEvaluationFunction } from '../../../db/repo/board';
import { MAX_AVOID } from '../../../domain/board/board';
import { logicalDate, parseLocalDate, toLocalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { isDomainError } from '../../../domain/errors';
import type { EvaluationFunction } from '../../../domain/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';

function threeMonthsLater(today: string): string {
  const d = parseLocalDate(today);
  d.setMonth(d.getMonth() + 3);
  return toLocalDate(d);
}

export default function EvaluationSettings() {
  const data = useLiveQuery(() => queryBoardData(), []);
  const today = logicalDate(Date.now());
  const [editing, setEditing] = useState<EvaluationFunction | null>(null);
  const [formKey, setFormKey] = useState(0);
  if (!data) return null;
  const current = data.efs.find((e) => e.endDate >= today) ?? null;
  const target = editing ?? (current && current.startDate <= today ? current : null);

  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="evaluation-settings">
      <ScreenHeader title={ja.board.evalForm.title} fallback="/board" />
      <EvalForm
        key={`${target?.id ?? 'new'}-${formKey}`}
        ef={target}
        today={today}
        onSaved={() => {
          setEditing(null);
          setFormKey((k) => k + 1);
        }}
      />
      {data.efs.length > 0 && (
        <section aria-label={ja.board.evalForm.list}>
          <h2 className="mb-2 text-h2">{ja.board.evalForm.list}</h2>
          <ul className="flex flex-col gap-2">
            {[...data.efs].reverse().map((e) => (
              <li key={e.id}>
                <Card className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-body">{e.metric}</p>
                    <p className="text-caption text-text-2">
                      {fill(ja.board.periodRange, { start: formatDateShort(e.startDate), end: formatDateShort(e.endDate) })}
                    </p>
                  </div>
                  {e.endDate >= today && (
                    <Button size="sm" variant="secondary" onClick={() => setEditing(e)}>
                      {target?.id === e.id ? ja.board.evalForm.editing : ja.board.edit}
                    </Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          {target && (
            <Button className="mt-3" variant="ghost" onClick={() => (setEditing(null), setFormKey((k) => k + 1))}>
              {ja.board.evalForm.newOne}
            </Button>
          )}
        </section>
      )}
    </main>
  );
}

function EvalForm({ ef, today, onSaved }: { ef: EvaluationFunction | null; today: string; onSaved: () => void }) {
  const { notify } = useFeedback();
  const [metric, setMetric] = useState(ef?.metric ?? '');
  const [avoid, setAvoid] = useState<string[]>(ef?.avoid ?? []);
  const [start, setStart] = useState(ef?.startDate ?? today);
  const [end, setEnd] = useState(ef?.endDate ?? threeMonthsLater(today));
  const [error, setError] = useState<string | null>(null);
  // 埋まっている欄の次に1つだけ空の欄を出す。最大3つ
  const fields = avoid.length < MAX_AVOID ? [...avoid, ''] : avoid;
  const valid = metric.trim().length > 0 && end > start;

  return (
    <Card className="flex flex-col gap-4" data-testid="eval-form">
      <TextField label={ja.board.evalForm.metric} hint={ja.board.evalHint} value={metric} onChange={setMetric} maxLength={100} />
      {fields.map((v, i) => (
        <TextField
          key={i}
          label={fill(ja.board.evalForm.avoidItem, { n: i + 1 })}
          value={v}
          maxLength={100}
          onChange={(text) =>
            setAvoid((list) => {
              const next = [...list];
              next[i] = text;
              return next.filter((x) => x.length > 0);
            })
          }
        />
      ))}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-label">{ja.board.evalForm.start}</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label">{ja.board.evalForm.end}</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-2" />
        </label>
      </div>
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
          setError(null);
          try {
            await saveEvaluationFunction({ id: ef?.id, metric, avoid, startDate: start, endDate: end }, Date.now());
            notify({ type: 'saved' });
            onSaved();
          } catch (e) {
            setError(copyByKey(isDomainError(e) ? e.copyKey : 'errors.unknown'));
          }
        }}
      >
        {ja.board.evalForm.save}
      </Button>
    </Card>
  );
}
