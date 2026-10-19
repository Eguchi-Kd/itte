// 盤面に追加（#/board/items/new）と、盤面の項目の編集（#/board/items/:id）
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { queryBoardItemById } from '../../../db/queries/board';
import { saveBoardItem } from '../../../db/repo/board';
import type { BoardItem, BoardItemType, LocalDate } from '../../../domain/types';
import { Button } from '../../components/Button';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';

const TYPES: BoardItemType[] = ['deadline', 'event', 'project', 'resource'];

export default function BoardItemEdit() {
  const { id } = useParams();
  const item = useLiveQuery(async () => (id ? ((await queryBoardItemById(id)) ?? null) : null), [id]);
  if (id && item === undefined) return null;
  if (id && !item) {
    return (
      <main className="flex flex-col gap-4 px-4">
        <ScreenHeader title={ja.board.item.editTitle} fallback="/board" />
        <p className="text-body">{ja.board.item.notFound}</p>
      </main>
    );
  }
  return <ItemForm key={item?.id ?? 'new'} item={item ?? null} />;
}

function ItemForm({ item }: { item: BoardItem | null }) {
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [type, setType] = useState<BoardItemType>(item?.type ?? 'deadline');
  const [title, setTitle] = useState(item?.title ?? '');
  const [due, setDue] = useState<LocalDate | ''>(item?.dueDate ?? '');
  const [busy, setBusy] = useState(false);
  const valid = title.trim().length > 0;

  return (
    <main className="flex flex-col gap-5 px-4 pb-8" data-testid="board-item-form">
      <ScreenHeader title={item ? ja.board.item.editTitle : ja.board.item.title} fallback="/board" />
      <div className="flex flex-col gap-2">
        <span className="text-label">{ja.board.item.type}</span>
        <ChipGroup label={ja.board.item.type}>
          {TYPES.map((t) => (
            <ChoiceChip key={t} selected={type === t} onToggle={() => setType(t)}>
              {ja.board.types[t]}
            </ChoiceChip>
          ))}
        </ChipGroup>
      </div>
      <TextField label={ja.board.item.text} value={title} onChange={setTitle} maxLength={200} testId="board-item-title" />
      <label className="flex flex-col gap-1">
        <span className="text-label">{ja.board.item.due}</span>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-3 text-body"
        />
      </label>
      <Button
        size="lg"
        block
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await saveBoardItem({ id: item?.id, type, title, dueDate: due || null }, Date.now());
            notify({ type: 'saved' });
            navigate('/board', { replace: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        {ja.board.item.save}
      </Button>
    </main>
  );
}
