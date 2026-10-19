// 段の階段（木）。最上位の段から子へのインデント表示。深さが5を超える段には「最上位から{n}段下」を併記する（§6.8.2）
import { Link } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { DEEP_DEPTH, flattenTree, type GoalTreeNode } from '../../../domain/goals/tree';
import type { GoalStatus, ID } from '../../../domain/types';

export const STATUS_LABEL: Record<GoalStatus, string> = { OPEN: ja.goals.open, MET: ja.goals.met, UNMET: ja.goals.unmet };

export function GoalTree({ roots, currentId, showHidden = true }: { roots: GoalTreeNode[]; currentId?: ID; showHidden?: boolean }) {
  const rows = flattenTree(roots).filter((n) => showHidden || n.goal.hiddenAt === null);
  return (
    <ul className="flex flex-col" data-testid="goal-tree">
      {rows.map(({ goal, depth }) => (
        <li key={goal.id} style={{ paddingLeft: `${Math.min(depth, 6) * 12}px` }} data-depth={depth}>
          <Link
            to={`/goals/${goal.id}`}
            aria-current={goal.id === currentId ? 'page' : undefined}
            className={`flex min-h-12 items-center gap-2 rounded-xl px-2 ${goal.id === currentId ? 'bg-primary-tint' : ''}`}
          >
            <span className="min-w-0 flex-1 truncate text-body">{goal.title}</span>
            {depth > DEEP_DEPTH && <span className="text-caption text-text-2">{fill(ja.goals.distance, { n: depth })}</span>}
            <span className="text-caption text-text-2">{STATUS_LABEL[goal.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
