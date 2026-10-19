// 段の一覧（§6.11）。最上位の段ごとに木を表示する。非表示の段は「非表示を表示」で出す
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ja } from '../../../copy/ja';
import { queryGoalsData } from '../../../db/queries/goals';
import { buildTree } from '../../../domain/goals/tree';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Toggle } from '../../components/Toggle';
import { GoalTree } from './GoalTree';

export default function GoalList() {
  const data = useLiveQuery(() => queryGoalsData(), []);
  const [showHidden, setShowHidden] = useState(false);
  if (!data) return null;
  const roots = buildTree(data.goals);
  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="goal-list">
      <ScreenHeader
        title={ja.goals.list.title}
        fallback="/library"
        right={
          <Link to="/goals/new" className="btn btn-secondary flex h-12 items-center gap-1 px-3 text-caption">
            <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
            {ja.goals.list.add}
          </Link>
        }
      />
      {roots.length === 0 ? (
        <p className="text-caption text-text-2">{ja.goals.list.empty}</p>
      ) : (
        roots.map((r) => (
          <Card key={r.goal.id}>
            <details open>
              <summary className="min-h-12 cursor-pointer text-h2">{r.goal.title}</summary>
              <GoalTree roots={[r]} showHidden={showHidden} />
            </details>
          </Card>
        ))
      )}
      <Toggle label={ja.goals.list.showHidden} checked={showHidden} onChange={setShowHidden} />
    </main>
  );
}
