// 習慣の一覧（§6.5.5）。「実行中」「定着済み」「終了」の3セクション
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryHabitList } from '../../../db/queries/habits';
import { logicalDate } from '../../../domain/dates';
import { recentRatio } from '../../../domain/habits/stats';
import type { HabitStatus } from '../../../domain/types';
import { ListRow } from '../../components/ListRow';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNow } from '../../hooks/useNow';

const SECTIONS: HabitStatus[] = ['active', 'graduated', 'ended'];

export default function HabitList() {
  const today = logicalDate(useNow());
  const data = useLiveQuery(() => queryHabitList(today), [today]);
  if (!data) return null;

  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="habit-list">
      <ScreenHeader
        title={ja.habits.list.title}
        fallback="/library"
        right={
          <Link
            to="/habits/new"
            className="btn btn-secondary flex h-12 items-center gap-1 px-3 text-caption"
            data-testid="habit-new"
          >
            <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
            {ja.habits.list.add}
          </Link>
        }
      />
      {SECTIONS.map((status) => {
        const items = data.habits.filter((h) => h.status === status);
        return (
          <section key={status} aria-label={ja.habits.list[status]} data-testid={`habit-section-${status}`}>
            <h2 className="mb-2 text-h2">{ja.habits.list[status]}</h2>
            {items.length === 0 ? (
              <p className="text-caption text-text-2">{ja.habits.list.empty}</p>
            ) : (
              <div className="card p-0">
                {items.map((h) => {
                  const r = recentRatio(h, data.logs, today, 28);
                  return (
                    <ListRow
                      key={h.id}
                      to={`/habits/${h.id}`}
                      title={h.name}
                      sub={fill(ja.habits.ratio28, { done: r.done, scheduled: r.scheduled })}
                    />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
