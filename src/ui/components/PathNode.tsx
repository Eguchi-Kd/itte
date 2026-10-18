import type { ReactNode } from 'react';

export type PathNodeState = 'next' | 'todo' | 'done';

interface Props {
  state: PathNodeState;
  icon: ReactNode;
  isLast?: boolean;
  children: ReactNode;
  testId?: string;
}

/** 道のノード（§5.8）。左にアイコンの丸、ノード同士を縦の線でつなぐ */
export function PathNode({ state, icon, isLast = false, children, testId }: Props) {
  return (
    <li className="relative flex gap-3" data-state={state} data-testid={testId}>
      <div className="flex flex-col items-center">
        <span
          className={`flex shrink-0 items-center justify-center rounded-full border-2 ${
            state === 'next'
              ? 'size-12 border-primary bg-primary text-white'
              : state === 'done'
                ? 'size-10 border-primary bg-primary-tint text-primary'
                : 'size-10 border-border bg-surface text-text-2'
          }`}
          aria-hidden="true"
        >
          {icon}
        </span>
        {!isLast && <span className="w-1 flex-1 rounded-full bg-border" aria-hidden="true" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-3'}`}>
        {state === 'next' ? (
          <div className="card border-primary p-4">{children}</div>
        ) : (
          <div
            className={`flex min-h-12 items-center gap-2 rounded-2xl px-3 py-1 ${
              state === 'done' ? 'bg-primary-tint' : 'border border-border bg-surface'
            }`}
          >
            {children}
          </div>
        )}
      </div>
    </li>
  );
}
