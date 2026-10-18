import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ja } from '../../copy/ja';
import { fill } from '../../copy/fill';
import { BottomSheet } from './BottomSheet';
import { Button, type ButtonVariant } from './Button';

interface Props {
  step: number;
  total: number;
  title: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  /** 入力があるとき、閉じる前に「やめると入力は消えます」を出す */
  dirty?: boolean;
  topRight?: ReactNode;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  primaryVariant?: ButtonVariant;
  onPrimary?: () => void;
  footer?: ReactNode;
}

/** レッスン形式の画面枠（§5.8）。上部に閉じるとステップ、中央に問い、下部に固定の主ボタン */
export function LessonShell({
  step,
  total,
  title,
  children,
  onClose,
  dirty = false,
  topRight,
  primaryLabel,
  primaryDisabled = false,
  primaryVariant = 'primary',
  onPrimary,
  footer,
}: Props) {
  const [leaving, setLeaving] = useState(false);
  return (
    <main className="app-column flex flex-col bg-bg" data-testid="lesson-shell">
      <header className="flex items-center gap-3 px-4 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label={ja.common.close}
          className="flex size-12 items-center justify-center rounded-2xl text-text-2"
          onClick={() => (dirty ? setLeaving(true) : onClose())}
        >
          <X size={24} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <div
          className="flex flex-1 gap-1"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step}
          aria-label={fill(ja.common.step, { n: step, total })}
        >
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-surface-2'}`} />
          ))}
        </div>
        <div className="min-w-12">{topRight}</div>
      </header>
      <section className="flex flex-1 flex-col gap-6 px-4 pt-6 pb-4">
        <h1 className="text-h1">{title}</h1>
        {children}
      </section>
      {(primaryLabel || footer) && (
        <footer className="bottom-actions sticky bottom-0 flex flex-col gap-2 bg-bg px-4 pt-3">
          {footer}
          {primaryLabel && (
            <Button size="lg" block variant={primaryVariant} disabled={primaryDisabled} onClick={onPrimary}>
              {primaryLabel}
            </Button>
          )}
        </footer>
      )}
      <BottomSheet open={leaving} onClose={() => setLeaving(false)} title={ja.common.leaveTitle}>
        <div className="flex flex-col gap-2 pb-2">
          <Button size="lg" block onClick={() => setLeaving(false)}>
            {ja.common.leaveStay}
          </Button>
          <Button size="lg" block variant="secondary" onClick={onClose}>
            {ja.common.leaveGo}
          </Button>
        </div>
      </BottomSheet>
    </main>
  );
}
