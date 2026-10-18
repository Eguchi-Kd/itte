import type { ReactNode } from 'react';
import { ja } from '../../copy/ja';

interface Props {
  onLater?: () => void;
  children: ReactNode;
  testId?: string;
}

/** 道の上に出る割り込みカード（§5.8）。右上に「あとで」 */
export function InterruptCard({ onLater, children, testId }: Props) {
  return (
    <section className="card relative p-4" data-testid={testId} aria-live="polite">
      {onLater && (
        <button
          type="button"
          className="absolute top-1 right-1 flex min-h-12 min-w-12 items-center justify-center rounded-2xl px-2 text-caption text-text-2"
          onClick={onLater}
        >
          {ja.common.later}
        </button>
      )}
      {children}
    </section>
  );
}
