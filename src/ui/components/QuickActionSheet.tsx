import { Compass, DoorOpen, LayoutGrid, Ruler, Sprout, Timer, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ja } from '../../copy/ja';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  /** 実験の A 条件（盤面プリセット）では「手番」を簡易記録にする（§6.2） */
  readingSheet?: boolean;
}

type Tile = { key: 'turn' | 'tenMin' | 'escaped' | 'measure' | 'boardAdd' | 'create'; icon: LucideIcon; to: string | null };

/** ＋ で開くシート（§6.2）。2列×3行の大きなタイル */
export function QuickActionSheet({ open, onClose, onNavigate, readingSheet = true }: Props) {
  const [creating, setCreating] = useState(false);
  const tiles: Tile[] = [
    { key: 'turn', icon: Compass, to: readingSheet ? '/moves/new' : '/moves/quick' },
    { key: 'tenMin', icon: Timer, to: '/tasks/new?start=1' },
    { key: 'escaped', icon: DoorOpen, to: '/escape/new' },
    { key: 'measure', icon: Ruler, to: '/measure/new' },
    { key: 'boardAdd', icon: LayoutGrid, to: '/board/items/new' },
    { key: 'create', icon: Sprout, to: null },
  ];
  const close = () => {
    setCreating(false);
    onClose();
  };
  const go = (to: string) => {
    setCreating(false);
    onNavigate(to);
  };

  return (
    <BottomSheet open={open} onClose={close} title={creating ? ja.today.createTitle : ja.quick.title} testId="quick-sheet">
      {creating ? (
        <div className="flex flex-col gap-2 pb-2">
          <Button size="lg" block onClick={() => go('/habits/new')}>
            {ja.today.createHabit}
          </Button>
          <Button size="lg" block variant="secondary" onClick={() => go('/goals/new')}>
            {ja.today.createGoal}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {tiles.map(({ key, icon: Icon, to }) => (
              <button
                key={key}
                type="button"
                className="card flex min-h-24 flex-col items-start gap-1 p-3 text-left"
                onClick={() => (to ? go(to) : setCreating(true))}
                data-testid={`quick-${key}`}
              >
                <Icon size={24} strokeWidth={2.25} className="text-primary" aria-hidden="true" />
                <span className="text-label">{ja.quick[key]}</span>
                <span className="text-caption text-text-2">{ja.quick[`${key}Sub`]}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 min-h-12 w-full text-caption text-text-2 underline"
            onClick={() => go('/moves/quick?retro=1')}
          >
            {ja.quick.retro}
          </button>
        </>
      )}
    </BottomSheet>
  );
}
