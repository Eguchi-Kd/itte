import { Check, Repeat } from 'lucide-react';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { formatAmount } from '../../../domain/display';
import type { HabitPathNode } from '../../../domain/path';
import { HoldButton } from '../../components/HoldButton';
import { PathNode } from '../../components/PathNode';

interface Props {
  node: HabitPathNode;
  isLast: boolean;
  onDone: () => void;
  onAmount: () => void;
  onUndo: () => void;
  onAddMore: () => void;
}

/** 道の習慣ノード（§6.3.2）。todo でも「やった」を持ち、1タップで記録できる */
export function HabitNodeView({ node, isLast, onDone, onAmount, onUndo, onAddMore }: Props) {
  const week = node.weekCount ? fill(ja.today.node.weekCount, node.weekCount) : null;
  const doneLabel = fill(ja.today.node.doneLabel, { name: node.name });
  const testId = `habit-node-${node.habitId}`;

  if (node.state === 'done') {
    return (
      <PathNode state="done" icon={<Check size={20} strokeWidth={2.25} />} isLast={isLast} testId={testId}>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-label">{node.name}</span>
          <span className="text-caption text-text-2" data-testid="recorded">
            {fill(ja.today.node.recordedAmount, { amount: formatAmount(node.recordedAmount ?? 0, node.unit) })}
          </span>
        </div>
        <button type="button" className="min-h-12 min-w-12 px-2 text-caption text-primary underline" onClick={onUndo}>
          {ja.common.undo}
        </button>
        <button type="button" className="min-h-12 min-w-12 px-2 text-caption text-primary underline" onClick={onAddMore}>
          {ja.today.node.addMore}
        </button>
      </PathNode>
    );
  }

  if (node.state === 'next') {
    return (
      <PathNode state="next" icon={<Repeat size={24} strokeWidth={2.25} />} isLast={isLast} testId={testId}>
        <h2 className="text-h2">{node.name}</h2>
        <p className="mt-1 text-body text-text-2">{node.intention}</p>
        {week && <p className="mt-1 text-caption text-text-2">{week}</p>}
        <HoldButton size="lg" block className="mt-4" aria-label={doneLabel} onTap={onDone} onHold={onAmount}>
          {ja.today.node.done}
        </HoldButton>
      </PathNode>
    );
  }

  return (
    <PathNode state="todo" icon={<Repeat size={20} strokeWidth={2.25} />} isLast={isLast} testId={testId}>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-label">{node.name}</span>
        {week && <span className="text-caption text-text-2">{week}</span>}
      </div>
      <HoldButton size="md" variant="secondary" aria-label={doneLabel} onTap={onDone} onHold={onAmount}>
        {ja.today.node.done}
      </HoldButton>
    </PathNode>
  );
}
