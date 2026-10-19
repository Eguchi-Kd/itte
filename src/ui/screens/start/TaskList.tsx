// やることの一覧（§6.11）。予定日と状態（予定／片づけ済み）で絞り込む
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ja } from '../../../copy/ja';
import { queryTasks } from '../../../db/queries/start';
import { formatDateShort } from '../../../domain/display';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { ListRow } from '../../components/ListRow';
import { ScreenHeader } from '../../components/ScreenHeader';

export default function TaskList() {
  const tasks = useLiveQuery(() => queryTasks(), []);
  const [filter, setFilter] = useState<'planned' | 'closed'>('planned');
  if (!tasks) return null;
  const items = tasks.filter((t) => (filter === 'planned' ? t.archivedAt === null : t.archivedAt !== null));

  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="task-list">
      <ScreenHeader
        title={ja.start.list.title}
        fallback="/library"
        right={
          <Link to="/tasks/new" className="btn btn-secondary flex h-12 items-center gap-1 px-3 text-caption">
            <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
            {ja.start.list.add}
          </Link>
        }
      />
      <ChipGroup label={ja.start.list.title}>
        {(['planned', 'closed'] as const).map((f) => (
          <ChoiceChip key={f} selected={filter === f} onToggle={() => setFilter(f)}>
            {ja.start.list[f]}
          </ChoiceChip>
        ))}
      </ChipGroup>
      {items.length === 0 ? (
        <p className="text-caption text-text-2">{ja.start.list.empty}</p>
      ) : (
        <div className="card p-0">
          {items.map((t) => (
            <ListRow key={t.id} to={`/tasks/${t.id}`} title={t.title} sub={formatDateShort(t.plannedFor)} />
          ))}
        </div>
      )}
    </main>
  );
}
