import { Scale } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { formatDateShort } from '../../../domain/display';
import type { JudgePathNode } from '../../../domain/path';
import { Button } from '../../components/Button';
import { PathNode } from '../../components/PathNode';

/** 道の判定ノード（§6.3.2）。期限を過ぎ、判定がない段 */
export function JudgeNodeView({ node, isLast }: { node: JudgePathNode; isLast: boolean }) {
  const navigate = useNavigate();
  const go = () => navigate(`/judge/${node.goalId}`);
  const testId = `judge-node-${node.goalId}`;
  if (node.state === 'next') {
    return (
      <PathNode state="next" icon={<Scale size={24} strokeWidth={2.25} />} isLast={isLast} testId={testId}>
        <h2 className="text-h2">{node.title}</h2>
        <p className="mt-1 text-body text-text-2">{fill(ja.today.node.judgeSub, { date: formatDateShort(node.deadline) })}</p>
        <Button size="lg" block className="mt-4" onClick={go}>
          {ja.today.node.judge}
        </Button>
      </PathNode>
    );
  }
  return (
    <PathNode state={node.state} icon={<Scale size={20} strokeWidth={2.25} />} isLast={isLast} testId={testId}>
      <span className="min-w-0 flex-1 truncate text-label">{node.title}</span>
      <Button size="md" variant="secondary" onClick={go}>
        {ja.today.node.judge}
      </Button>
    </PathNode>
  );
}
