import { ChevronRight } from 'lucide-react';
import { ja } from '../../copy/ja';

export type EntryTarget = 'habit' | 'start' | 'move' | 'goal';

/** 入口の4択の遷移先（§6.4 ステップ7） */
export const ENTRY_PATHS: Record<EntryTarget, string> = {
  habit: '/habits/new',
  start: '/tasks/new?start=1',
  move: '/moves/new',
  goal: '/goals/new',
};

const LABELS: Record<EntryTarget, string> = {
  habit: ja.onboarding.entryHabit,
  start: ja.onboarding.entryStart,
  move: ja.onboarding.entryMove,
  goal: ja.onboarding.entryGoal,
};

interface Props {
  onChoose: (target: EntryTarget) => void;
}

/** 「いま、いちばん近いのは?」の4つの大きな選択カード */
export function EntryChoices({ onChoose }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {(Object.keys(LABELS) as EntryTarget[]).map((t) => (
        <button
          key={t}
          type="button"
          className="card flex min-h-16 items-center gap-3 p-4 text-left text-body"
          onClick={() => onChoose(t)}
          data-testid={`entry-${t}`}
        >
          <span className="flex-1">{LABELS[t]}</span>
          <ChevronRight size={20} strokeWidth={2.25} className="text-text-2" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
