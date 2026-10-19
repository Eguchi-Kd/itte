// 指標の一覧（§6.11）。最新の実測と、実測の記録への入口
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryMetricsData } from '../../../db/queries/goals';
import { logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { ScreenHeader } from '../../components/ScreenHeader';

export default function MetricList() {
  const data = useLiveQuery(() => queryMetricsData(), []);
  if (!data) return null;
  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="metric-list">
      <ScreenHeader title={ja.goals.metrics.title} fallback="/library" />
      {data.metrics.length === 0 ? (
        <p className="text-caption text-text-2">{ja.goals.metrics.empty}</p>
      ) : (
        <ul className="card p-0">
          {data.metrics.map((m) => {
            const latest = data.measurements.filter((x) => x.metricId === m.id).sort((a, b) => b.measuredAt - a.measuredAt)[0];
            return (
              <li key={m.id} className="flex min-h-14 items-center gap-2 border-b border-border px-4 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-body">{m.name}</p>
                  <p className="text-caption text-text-2">
                    {latest
                      ? fill(ja.goals.metrics.latest, { value: latest.value, unit: m.unit, date: formatDateShort(logicalDate(latest.measuredAt)) })
                      : ja.goals.metrics.none}
                  </p>
                </div>
                <Link to={`/measure/new?metricId=${m.id}`} className="btn btn-secondary flex h-12 items-center px-3 text-caption">
                  {ja.goals.metrics.measure}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
