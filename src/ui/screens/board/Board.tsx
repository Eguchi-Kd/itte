// 盤面（§6.7.1）。評価関数、期限リスト（盤面の項目と段の合成）、進行中の案件、資源
import { useLiveQuery } from 'dexie-react-hooks';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryBoardData } from '../../../db/queries/board';
import { deleteBoardItem, restoreBoardItem, setBoardItemStatus } from '../../../db/repo/board';
import { activeEvaluation, buildBoard, dueLabel, type DeadlineRow } from '../../../domain/board/board';
import { diffDays, logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import type { BoardItem } from '../../../domain/types';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ListRow } from '../../components/ListRow';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useNow } from '../../hooks/useNow';

export default function Board() {
  const navigate = useNavigate();
  const today = logicalDate(useNow());
  const data = useLiveQuery(() => queryBoardData(), []);
  const { toast, notify } = useFeedback();
  const [menuFor, setMenuFor] = useState<BoardItem | null>(null);
  if (!data) return null;

  const ef = activeEvaluation(data.efs, today);
  const board = buildBoard(data.items, data.goals, today);
  const empty = !ef && board.deadlines.length === 0 && board.projects.length === 0 && board.resources.length === 0;

  const remove = async (item: BoardItem) => {
    setMenuFor(null);
    const removed = await deleteBoardItem(item.id);
    if (removed) toast(ja.board.deleted, () => void restoreBoardItem(removed));
  };

  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-6" data-testid="board">
      <header className="flex items-center justify-between">
        <h1 className="text-h1">{ja.board.title}</h1>
        <Link to="/board/items/new" className="btn btn-secondary flex h-12 items-center gap-1 px-3 text-caption">
          <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
          {ja.board.add}
        </Link>
      </header>

      <Card data-testid="eval-card">
        {ef ? (
          <>
            <p className="text-caption text-text-2">{ja.board.evalQ}</p>
            <h2 className="text-h2">{ef.metric}</h2>
            {ef.avoid.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label={ja.board.avoid}>
                {ef.avoid.map((a) => (
                  <li key={a} className="rounded-full bg-surface-2 px-3 py-1 text-caption">
                    {a}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-caption text-text-2">
              {fill(ja.board.period, {
                start: formatDateShort(ef.startDate),
                end: formatDateShort(ef.endDate),
                n: diffDays(ef.endDate, today),
              })}
            </p>
          </>
        ) : (
          <>
            <p className="text-body text-text-2">{ja.board.evalNone}</p>
            <Button className="mt-3" onClick={() => navigate('/settings/evaluation')}>
              {ja.today.setEval}
            </Button>
          </>
        )}
      </Card>

      {empty ? (
        <EmptyState text={ja.board.empty} actionLabel={ja.board.emptyAction} onAction={() => navigate('/board/items/new')} />
      ) : (
        <>
          <Section title={ja.board.deadlines} testId="deadline-list">
            {board.deadlines.map((row) => (
              <DeadlineItem key={`${row.kind}:${row.id}`} row={row} onMenu={setMenuFor} />
            ))}
          </Section>
          <Section title={ja.board.projects} testId="project-list">
            {board.projects.map((i) => (
              <ItemRow key={i.id} title={i.title} item={i} onMenu={setMenuFor} />
            ))}
          </Section>
          <Section title={ja.board.resources} testId="resource-list">
            {board.resources.map((i) => (
              <ItemRow key={i.id} title={i.title} item={i} onMenu={setMenuFor} />
            ))}
          </Section>
        </>
      )}

      <div className="card p-0">
        <ListRow to="/settings/evaluation" title={ja.board.evalForm.title} />
        <ListRow to="/settings/triggers" title={ja.board.triggers.title} />
      </div>

      <BottomSheet open={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.title}>
        {menuFor && (
          <div className="flex flex-col gap-2 pb-2">
            <Button size="lg" block variant="accent" onClick={() => navigate(`/tasks/new?boardItemId=${menuFor.id}`)}>
              {ja.board.touch}
            </Button>
            <Button
              size="lg"
              block
              variant="secondary"
              onClick={async () => {
                await setBoardItemStatus(menuFor.id, 'done', Date.now());
                setMenuFor(null);
                notify({ type: 'saved' });
              }}
            >
              {ja.board.markDone}
            </Button>
            <Button size="lg" block variant="secondary" onClick={() => navigate(`/board/items/${menuFor.id}`)}>
              {ja.board.edit}
            </Button>
            <Button size="lg" block variant="ghost" onClick={() => void remove(menuFor)}>
              {ja.board.delete}
            </Button>
          </div>
        )}
      </BottomSheet>
    </main>
  );
}

function Section({ title, testId, children }: { title: string; testId: string; children: React.ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <section aria-label={title} data-testid={testId}>
      <h2 className="mb-2 text-h2">{title}</h2>
      <ul className="card p-0">{children}</ul>
    </section>
  );
}

function DeadlineItem({ row, onMenu }: { row: DeadlineRow; onMenu: (i: BoardItem) => void }) {
  const due = row.daysLeft === null ? ja.board.item.dueNone : dueLabel(row.daysLeft);
  if (row.kind === 'goal') {
    return (
      <li className="border-b border-border last:border-b-0">
        <Link to={`/goals/${row.id}`} className="flex min-h-14 items-center gap-2 px-4 py-2">
          <span className="rounded-full bg-primary-tint px-2 text-caption">{ja.board.goalLabel}</span>
          <span className="min-w-0 flex-1 truncate text-body">{row.title}</span>
          <span className="text-caption text-text-2">{due}</span>
        </Link>
      </li>
    );
  }
  return <ItemRow title={row.title} sub={due} item={row.item as BoardItem} onMenu={onMenu} />;
}

function ItemRow({ title, sub, item, onMenu }: { title: string; sub?: string; item: BoardItem; onMenu: (i: BoardItem) => void }) {
  return (
    <li className="flex min-h-14 items-center gap-2 border-b border-border px-4 py-1 last:border-b-0" data-testid={`board-item-${item.id}`}>
      <span className="text-caption text-text-2">{ja.board.types[item.type]}</span>
      <span className="min-w-0 flex-1 truncate text-body">{title}</span>
      {sub && <span className="text-caption text-text-2">{sub}</span>}
      <button
        type="button"
        aria-label={fill(ja.board.menu, { title })}
        className="flex size-12 items-center justify-center rounded-2xl text-text-2"
        onClick={() => onMenu(item)}
      >
        <MoreHorizontal size={20} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </li>
  );
}
