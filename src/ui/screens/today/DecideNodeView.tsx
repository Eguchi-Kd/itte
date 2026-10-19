import { Swords } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { decideMove } from '../../../db/repo/board';
import type { DecidePathNode } from '../../../domain/path';
import { Button } from '../../components/Button';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { PathNode } from '../../components/PathNode';
import { useFeedback } from '../../feedback/FeedbackProvider';

/** 道の「決めかけの手」ノード（§6.3.2）。候補を選ぶ → 決める の2タップ */
export function DecideNodeView({ node, isLast }: { node: DecidePathNode; isLast: boolean }) {
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [chosen, setChosen] = useState<string | null>(null);
  const testId = `decide-node-${node.moveId}`;

  if (node.state === 'next') {
    return (
      <PathNode state="next" icon={<Swords size={24} strokeWidth={2.25} />} isLast={isLast} testId={testId}>
        <h2 className="text-h2">{node.situation}</h2>
        <ChipGroup label={ja.board.chooseQ} className="mt-3">
          {node.candidates.map((c) => (
            <ChoiceChip key={c.id} selected={chosen === c.id} onToggle={() => setChosen(c.id)}>
              {c.description}
            </ChoiceChip>
          ))}
        </ChipGroup>
        <Button
          size="lg"
          block
          className="mt-4"
          disabled={!chosen}
          onClick={async () => {
            if (!chosen) return;
            await decideMove(node.moveId, chosen, Date.now());
            notify({ type: 'moveDecided' });
          }}
        >
          {ja.today.node.decide}
        </Button>
      </PathNode>
    );
  }
  return (
    <PathNode state={node.state} icon={<Swords size={20} strokeWidth={2.25} />} isLast={isLast} testId={testId}>
      <span className="min-w-0 flex-1 truncate text-label">{node.situation}</span>
      <Button
        size="md"
        variant="secondary"
        aria-label={fill(ja.board.move.decideLabel, { situation: node.situation })}
        onClick={() => navigate(`/moves/${node.moveId}`)}
      >
        {ja.today.node.decide}
      </Button>
    </PathNode>
  );
}
