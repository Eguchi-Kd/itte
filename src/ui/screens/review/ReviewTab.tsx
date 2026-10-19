// ふりかえりタブ（§6.10）。今週のふりかえりの入口、過去の週、数字・較正・傾向と対策・実験への入口
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryWeeklyData } from '../../../db/queries/review';
import { addDays, logicalDate, weekStartOf } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { reviewTargetWeek } from '../../../domain/review/weekly';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ListRow } from '../../components/ListRow';
import { useNow } from '../../hooks/useNow';

const PAST_WEEKS = 8;

export default function ReviewTab() {
  const navigate = useNavigate();
  const today = logicalDate(useNow());
  const data = useLiveQuery(() => queryWeeklyData(), []);
  if (!data) return null;
  const current = reviewTargetWeek(today) ?? weekStartOf(today);
  const run = data.runs.find((r) => r.weekStart === current);
  const past = Array.from({ length: PAST_WEEKS }, (_, i) => addDays(current, -7 * (i + 1)));

  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-6" data-testid="review-tab">
      <h1 className="text-h1">{ja.review.tab}</h1>
      <Card data-testid="weekly-entry">
        <p className="text-caption text-text-2">{fill(ja.review.weekOf, { date: formatDateShort(current) })}</p>
        <h2 className="text-h2">{ja.review.thisWeek}</h2>
        {run?.completedAt ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-body">{ja.review.recorded}</span>
            <Button variant="secondary" onClick={() => navigate(`/review/weekly/${current}`)}>
              {ja.review.reopen}
            </Button>
          </div>
        ) : (
          <Button size="lg" block className="mt-3" onClick={() => navigate(`/review/weekly/${current}`)}>
            {ja.review.start}
          </Button>
        )}
      </Card>
      <div className="card p-0">
        <ListRow to="/review/numbers" title={ja.review.numbers} />
        <ListRow to="/review/calibration" title={ja.review.calibration} />
        <ListRow to="/review/patterns" title={ja.review.patterns} />
        <ListRow to="/review/experiment" title={ja.review.experiment} />
      </div>
      <section aria-label={ja.review.pastWeeks}>
        <h2 className="mb-2 text-h2">{ja.review.pastWeeks}</h2>
        <div className="card p-0">
          {past.map((ws) => {
            const r = data.runs.find((x) => x.weekStart === ws);
            return (
              <ListRow
                key={ws}
                to={`/review/weekly/${ws}`}
                title={fill(ja.review.weekOf, { date: formatDateShort(ws) })}
                sub={r?.completedAt ? ja.review.recorded : ja.review.notStarted}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
