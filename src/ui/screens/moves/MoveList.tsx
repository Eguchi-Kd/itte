// 手の記録（§6.11）。週ごとに、決定済み・未決定・簡易記録・あとから記録のラベル
import { useLiveQuery } from 'dexie-react-hooks';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryMoves } from '../../../db/queries/board';
import { logicalDate, weekStartOf } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import type { Move } from '../../../domain/types';
import { ListRow } from '../../components/ListRow';
import { ScreenHeader } from '../../components/ScreenHeader';

function label(m: Move): string {
  const parts: string[] = [m.mode === 'quick' ? ja.board.move.quick : m.decidedAt ? ja.board.move.decided : ja.board.move.undecided];
  if (m.retro) parts.push(ja.board.move.retro);
  return parts.join(ja.common.separator);
}

export default function MoveList() {
  const data = useLiveQuery(() => queryMoves(), []);
  if (!data) return null;
  const weeks = new Map<string, Move[]>();
  for (const m of data.moves) {
    const ws = weekStartOf(logicalDate(m.createdAt));
    weeks.set(ws, [...(weeks.get(ws) ?? []), m]);
  }
  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="move-list">
      <ScreenHeader title={ja.board.move.listTitle} fallback="/library" />
      {data.moves.length === 0 && <p className="text-caption text-text-2">{ja.board.move.empty}</p>}
      {[...weeks].map(([ws, moves]) => (
        <section key={ws} aria-label={fill(ja.board.move.week, { date: formatDateShort(ws) })}>
          <h2 className="mb-2 text-h2">{fill(ja.board.move.week, { date: formatDateShort(ws) })}</h2>
          <div className="card p-0">
            {moves.map((m) => (
              <ListRow key={m.id} to={`/moves/${m.id}`} title={m.situation} sub={label(m)} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
