// ホームの盤面の帯（§6.3.1-2）。盤面モジュールのデータがあるときだけ出す
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryBoardData } from '../../../db/queries/board';
import { activeEvaluation, buildBoard, dueLabel } from '../../../domain/board/board';
import type { LocalDate } from '../../../domain/types';
import { Banner } from '../../components/Banner';

export function BoardStrip({ today }: { today: LocalDate }) {
  const data = useLiveQuery(() => queryBoardData(), []);
  if (!data) return null;
  const ef = activeEvaluation(data.efs, today);
  // 有効な評価関数がなく、盤面モジュールを使ったことがあるときは、帯の代わりにバナー（AC-BOARD-03）
  if (!ef) {
    return data.boardUsed ? (
      <div data-testid="eval-banner">
        <Banner text={ja.today.setEval} to="/settings/evaluation" />
      </div>
    ) : null;
  }
  const chips = buildBoard(data.items, data.goals, today)
    .deadlines.filter((r) => r.daysLeft !== null)
    .slice(0, 3);
  return (
    <Link to="/board" className="card flex flex-col gap-2 p-3" data-testid="board-strip">
      <span className="text-label">{fill(ja.today.evalStrip, { metric: ef.metric })}</span>
      {chips.length > 0 && (
        <span className="flex flex-wrap gap-2">
          {chips.map((r) => (
            <span key={`${r.kind}:${r.id}`} className="rounded-full bg-surface-2 px-3 py-1 text-caption">
              {fill(ja.board.dueChip, { title: r.title, due: dueLabel(r.daysLeft ?? 0) })}
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}
