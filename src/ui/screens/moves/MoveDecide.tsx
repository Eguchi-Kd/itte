// 手を決める（§6.7.6）。候補カード（1手後・2手後・点数を展開表示）と「これにする」
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { queryMove } from '../../../db/queries/board';
import { decideMove } from '../../../db/repo/board';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useFeedback } from '../../feedback/FeedbackProvider';

export default function MoveDecide() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const data = useLiveQuery(() => queryMove(id), [id]);
  const [chosen, setChosen] = useState<string | null>(null);
  if (!data) return null;
  const { move, candidates } = data;
  if (!move) {
    return (
      <main className="flex flex-col gap-4 px-4">
        <ScreenHeader title={ja.board.move.decideTitle} fallback="/" />
        <p className="text-body">{ja.board.move.notFound}</p>
      </main>
    );
  }
  const current = chosen ?? move.chosenCandidateId;

  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="move-decide">
      <ScreenHeader title={ja.board.move.decideTitle} fallback="/" />
      <h2 className="text-h2">{move.situation}</h2>
      {move.mode === 'quick' ? (
        <p className="text-body">
          {ja.board.move.chosen}: {move.chosenText}
        </p>
      ) : (
        <div role="radiogroup" aria-label={ja.board.chooseQ} className="flex flex-col gap-2">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={current === c.id}
              onClick={() => setChosen(c.id)}
              className={`card flex flex-col gap-1 p-4 text-left ${current === c.id ? 'border-primary bg-primary-tint' : ''}`}
            >
              <span className="text-h2">{c.description}</span>
              {c.plus1 && (
                <span className="text-caption text-text-2">
                  {ja.board.plus1}: {c.plus1}
                </span>
              )}
              {c.plus2 && (
                <span className="text-caption text-text-2">
                  {ja.board.plus2}: {c.plus2}
                </span>
              )}
              {c.score !== null && <span className="text-caption text-text-2">{c.score > 0 ? `+${c.score}` : c.score}</span>}
            </button>
          ))}
        </div>
      )}
      {move.mode === 'full' && move.decidedAt === null && (
        <Button
          size="lg"
          block
          disabled={!chosen}
          onClick={async () => {
            if (!chosen) return;
            await decideMove(move.id, chosen, Date.now());
            notify({ type: 'moveDecided' });
            navigate('/', { replace: true });
          }}
        >
          {ja.board.chooseThis}
        </Button>
      )}
    </main>
  );
}
