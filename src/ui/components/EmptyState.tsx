import { Koma } from '../mascot/Koma';
import { Button } from './Button';

interface Props {
  pose?: 'point' | 'sit';
  text: string;
  actionLabel: string;
  onAction: () => void;
}

/** 空の状態（§5.8、X8）。コマと1文と主ボタン1つ */
export function EmptyState({ pose = 'point', text, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center" data-testid="empty-state">
      <Koma pose={pose} />
      <p className="text-body">{text}</p>
      <Button size="lg" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
