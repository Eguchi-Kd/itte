// 実測を記録（§6.8.3）。追記専用なので「確かめる」→ 確認シート →「記録する」の2段
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryMetrics } from '../../../db/queries/goals';
import { recordMeasurement } from '../../../db/repo/goals';
import { Button } from '../../components/Button';
import { CheckSheet } from '../../components/CheckSheet';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';

function localDateTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function MeasureNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { notify } = useFeedback();
  const metrics = useLiveQuery(() => queryMetrics(), []);
  const [metricId, setMetricId] = useState<string | null>(params.get('metricId'));
  const [value, setValue] = useState('');
  const [at, setAt] = useState(() => localDateTime(Date.now()));
  const [memo, setMemo] = useState('');
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!metrics) return null;

  const metric = metrics.find((m) => m.id === metricId) ?? null;
  const num = value.trim() === '' ? Number.NaN : Number(value);
  const measuredAt = new Date(at).getTime();
  const valid = metric !== null && Number.isFinite(num) && Number.isFinite(measuredAt);

  return (
    <main className="flex flex-col gap-5 px-4 pb-8" data-testid="measure-new">
      <ScreenHeader title={ja.goals.measure.title} fallback="/" />
      {metrics.length === 0 ? (
        <p className="text-body">{ja.goals.measure.noMetric}</p>
      ) : (
        <>
          <ChipGroup label={ja.goals.metricQ}>
            {metrics.map((m) => (
              <ChoiceChip key={m.id} selected={metricId === m.id} onToggle={() => setMetricId(m.id)}>
                {m.name}
              </ChoiceChip>
            ))}
          </ChipGroup>
          <TextField label={ja.goals.field.value} value={value} onChange={setValue} maxLength={20} />
          <label className="flex flex-col gap-1">
            <span className="text-label">{ja.goals.field.at}</span>
            <input
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-3 text-body"
            />
          </label>
          <TextField label={`${ja.goals.field.memo}${ja.common.optional}`} value={memo} onChange={setMemo} maxLength={200} />
          <Button size="lg" block disabled={!valid} onClick={() => setChecking(true)}>
            {ja.common.check}
          </Button>
        </>
      )}
      <CheckSheet
        open={checking}
        title={ja.goals.measure.check}
        confirmLabel={ja.goals.measure.record}
        busy={busy}
        onFix={() => setChecking(false)}
        onConfirm={async () => {
          if (!metric) return;
          setBusy(true);
          try {
            await recordMeasurement({ metricId: metric.id, value: num, measuredAt, note: memo }, Date.now());
            notify({ type: 'measurement' });
            navigate('/', { replace: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        {metric && <p className="text-h2">{fill(ja.goals.measure.summary, { metric: metric.name, value, unit: metric.unit })}</p>}
      </CheckSheet>
    </main>
  );
}
