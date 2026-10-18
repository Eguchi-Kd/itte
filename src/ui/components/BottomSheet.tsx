import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ja } from '../../copy/ja';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testId?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
const SWIPE_CLOSE_PX = 80;

/** 下からのシート。つまみ、下スワイプで閉じる、フォーカストラップ、Esc で閉じる（§5.8） */
export function BottomSheet({ open, onClose, title, children, testId }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = panel.current;
    const first = el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className="fade-enter absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        className="sheet-enter bottom-actions absolute inset-x-0 bottom-0 mx-auto max-h-[90dvh] max-w-[480px] overflow-y-auto rounded-t-3xl bg-surface px-4 pt-2"
      >
        <div
          className="flex h-8 items-center justify-center touch-none"
          onPointerDown={(e) => {
            startY.current = e.clientY;
          }}
          onPointerUp={(e) => {
            if (startY.current !== null && e.clientY - startY.current > SWIPE_CLOSE_PX) onClose();
            startY.current = null;
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>
        {title && <h2 className="mb-3 text-h2">{title}</h2>}
        {children}
        <span className="sr-only">
          <button type="button" onClick={onClose}>
            {ja.common.close}
          </button>
        </span>
      </div>
    </div>,
    document.body,
  );
}
