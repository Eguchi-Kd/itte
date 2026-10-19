import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { copyByKey } from '../../copy/fill';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { Snackbar } from '../components/Snackbar';
import { useSettings } from '../hooks/useSettings';
import { emitFeedback } from './emit';
import { feedbackFor, type FeedbackEvent } from './feedbackFor';

export const SNACKBAR_MS = 5000;
export const FEEDBACK_SHEET_MS = 1200;

interface NotifyOptions {
  /** 取り消しを付けるとスナックバー（5秒）、なければフィードバックシート（1.2秒） */
  undo?: () => void;
  /** フィードバックシートを閉じたあとに呼ぶ */
  onDone?: () => void;
}

interface FeedbackApi {
  notify: (e: FeedbackEvent, opts?: NotifyOptions) => void;
  /** 記録ではない操作（削除など）の取り消し付き通知。音と振動は出さない */
  toast: (text: string, undo?: () => void) => void;
}

const Ctx = createContext<FeedbackApi>({ notify: () => undefined, toast: () => undefined });

type Shown =
  | { kind: 'sheet'; id: number; text: string; onDone?: () => void }
  | { kind: 'snack'; id: number; text: string; undo?: () => void };

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [shown, setShown] = useState<Shown | null>(null);
  const [live, setLive] = useState('');
  const seq = useRef(0);

  const notify = useCallback((e: FeedbackEvent, opts: NotifyOptions = {}) => {
    const spec = feedbackFor(e);
    const text = copyByKey(spec.copyKey);
    emitFeedback(spec, settingsRef.current ?? undefined);
    seq.current += 1;
    setLive(text);
    setShown(
      opts.undo
        ? { kind: 'snack', id: seq.current, text, undo: opts.undo }
        : { kind: 'sheet', id: seq.current, text, onDone: opts.onDone },
    );
  }, []);

  const shownRef = useRef<Shown | null>(null);
  shownRef.current = shown;

  const close = useCallback((id: number) => {
    const cur = shownRef.current;
    if (!cur || cur.id !== id) return;
    shownRef.current = null;
    setShown(null);
    if (cur.kind === 'sheet') cur.onDone?.();
  }, []);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => close(shown.id), shown.kind === 'snack' ? SNACKBAR_MS : FEEDBACK_SHEET_MS);
    return () => clearTimeout(t);
  }, [shown, close]);

  const toast = useCallback((text: string, undo?: () => void) => {
    seq.current += 1;
    setLive(text);
    setShown({ kind: 'snack', id: seq.current, text, undo });
  }, []);

  const api = useMemo(() => ({ notify, toast }), [notify, toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {live}
      </div>
      {shown?.kind === 'sheet' && <FeedbackSheet text={shown.text} onNext={() => close(shown.id)} />}
      {shown?.kind === 'snack' && (
        <Snackbar
          text={shown.text}
          onUndo={
            shown.undo
              ? () => {
                  shown.undo?.();
                  close(shown.id);
                }
              : undefined
          }
        />
      )}
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  return useContext(Ctx);
}
