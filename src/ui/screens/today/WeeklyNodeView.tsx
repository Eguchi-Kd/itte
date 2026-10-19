import { CalendarCheck, Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import type { WeeklyPathNode } from '../../../domain/path';
import { Button } from '../../components/Button';
import { PathNode } from '../../components/PathNode';

/** 道の週次ふりかえりノード（§6.3.2）。金曜4:00〜翌週火曜4:00 */
export function WeeklyNodeView({ node, isLast }: { node: WeeklyPathNode; isLast: boolean }) {
  const navigate = useNavigate();
  const go = () => navigate(`/review/weekly/${node.weekStart}`);
  if (node.state === 'next') {
    return (
      <PathNode state="next" icon={<CalendarCheck size={24} strokeWidth={2.25} />} isLast={isLast} testId="weekly-node">
        <h2 className="text-h2">{ja.today.node.weekly}</h2>
        <Button size="lg" block className="mt-4" onClick={go}>
          {ja.review.start}
        </Button>
      </PathNode>
    );
  }
  return (
    <PathNode
      state={node.state}
      icon={node.state === 'done' ? <Check size={20} strokeWidth={2.25} /> : <CalendarCheck size={20} strokeWidth={2.25} />}
      isLast={isLast}
      testId="weekly-node"
    >
      <span className="min-w-0 flex-1 truncate text-label">{ja.today.node.weekly}</span>
      {node.state === 'done' ? (
        <span className="text-caption text-text-2">{ja.common.recorded}</span>
      ) : (
        <Button size="md" variant="secondary" onClick={go}>
          {ja.review.start}
        </Button>
      )}
    </PathNode>
  );
}
