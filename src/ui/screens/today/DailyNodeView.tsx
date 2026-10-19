import { Check, Moon } from 'lucide-react';
import { ja } from '../../../copy/ja';
import type { PathNodeState } from '../../../domain/path';
import { Button } from '../../components/Button';
import { PathNode } from '../../components/PathNode';

interface Props {
  state: PathNodeState;
  isLast: boolean;
  onAnswer: () => void;
}

/** 道の「1日のしめ」ノード（§6.3.2） */
export function DailyNodeView({ state, isLast, onAnswer }: Props) {
  if (state === 'next') {
    return (
      <PathNode state="next" icon={<Moon size={24} strokeWidth={2.25} />} isLast={isLast} testId="daily-node">
        <h2 className="text-h2">{ja.today.node.daily}</h2>
        <Button size="lg" block className="mt-4" onClick={onAnswer}>
          {ja.today.node.answer}
        </Button>
      </PathNode>
    );
  }
  return (
    <PathNode
      state={state}
      icon={state === 'done' ? <Check size={20} strokeWidth={2.25} /> : <Moon size={20} strokeWidth={2.25} />}
      isLast={isLast}
      testId="daily-node"
    >
      <span className="min-w-0 flex-1 truncate text-label">{ja.today.node.daily}</span>
      {state === 'done' ? (
        <span className="text-caption text-text-2">{ja.common.recorded}</span>
      ) : (
        <Button size="md" variant="secondary" onClick={onAnswer}>
          {ja.today.node.answer}
        </Button>
      )}
    </PathNode>
  );
}
