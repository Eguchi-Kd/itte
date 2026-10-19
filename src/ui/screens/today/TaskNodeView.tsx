import { Check, Timer } from 'lucide-react';
import { Link } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import type { TaskPathNode } from '../../../domain/path';
import { Button } from '../../components/Button';
import { PathNode } from '../../components/PathNode';

interface Props {
  node: TaskPathNode;
  isLast: boolean;
  onStart: () => void;
}

/** 道のやることノード（§6.3.2）。次の一手（なければタイトル）と「始める」（--accent） */
export function TaskNodeView({ node, isLast, onStart }: Props) {
  const startLabel = fill(ja.start.startLabel, { label: node.label });
  const testId = `task-node-${node.taskId}`;
  const title = (
    <Link to={`/tasks/${node.taskId}`} className="min-w-0 truncate underline-offset-2 hover:underline">
      {node.label}
    </Link>
  );

  if (node.state === 'next') {
    return (
      <PathNode state="next" icon={<Timer size={24} strokeWidth={2.25} />} isLast={isLast} testId={testId}>
        <h2 className="text-h2">{title}</h2>
        {node.label !== node.title && <p className="mt-1 text-body text-text-2">{node.title}</p>}
        <Button size="lg" block variant="accent" className="mt-4" aria-label={startLabel} onClick={onStart}>
          {ja.today.node.start}
        </Button>
      </PathNode>
    );
  }

  return (
    <PathNode
      state={node.state}
      icon={node.state === 'done' ? <Check size={20} strokeWidth={2.25} /> : <Timer size={20} strokeWidth={2.25} />}
      isLast={isLast}
      testId={testId}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-label">{title}</span>
        {node.state === 'done' && <span className="text-caption text-text-2">{ja.common.recorded}</span>}
      </div>
      <Button size="md" variant={node.state === 'done' ? 'secondary' : 'accent'} aria-label={startLabel} onClick={onStart}>
        {ja.today.node.start}
      </Button>
    </PathNode>
  );
}
