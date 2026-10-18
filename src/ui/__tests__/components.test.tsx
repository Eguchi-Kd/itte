import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { LessonShell } from '../components/LessonShell';
import { AUTO_ADVANCE_MS, ScaleInput } from '../components/ScaleInput';
import { FeedbackProvider, FEEDBACK_SHEET_MS, SNACKBAR_MS, useFeedback } from '../feedback/FeedbackProvider';

afterEach(() => {
  vi.useRealTimers();
});

describe('LessonShell', () => {
  it('入力があるときに閉じると「やめると入力は消えます」を出し、続けるで残る', () => {
    const onClose = vi.fn();
    render(
      <LessonShell step={2} total={4} title="q" onClose={onClose} dirty primaryLabel={ja.common.next} primaryDisabled>
        <p>body</p>
      </LessonShell>,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByRole('button', { name: ja.common.next })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: ja.common.close }));
    expect(screen.getByRole('dialog', { name: ja.common.leaveTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ja.common.leaveStay }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('入力がなければそのまま閉じる', () => {
    const onClose = vi.fn();
    render(<LessonShell step={1} total={4} title="q" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: ja.common.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('BottomSheet', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>open</button>
        <BottomSheet open={open} onClose={() => setOpen(false)} title="t">
          <button>a</button>
          <button>b</button>
        </BottomSheet>
      </>
    );
  }

  it('開くと中にフォーカスが移り、Esc で閉じて元の要素に戻る', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'open' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 't' })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'a' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('ScaleInput', () => {
  it('選ぶと 250ms 後に次へ進む', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onAdvance = vi.fn();
    render(<ScaleInput label="q" value={null} onChange={onChange} onAdvance={onAdvance} />);
    fireEvent.click(screen.getAllByRole('radio')[3]);
    expect(onChange).toHaveBeenCalledWith(4);
    act(() => vi.advanceTimersByTime(AUTO_ADVANCE_MS - 1));
    expect(onAdvance).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe('Button', () => {
  it('loading で押せなくなり、幅を変えずにスピナーを出す', () => {
    render(<Button loading>{ja.common.save}</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('FeedbackProvider', () => {
  function Trigger({ withUndo, onUndo }: { withUndo: boolean; onUndo?: () => void }) {
    const { notify } = useFeedback();
    return (
      <button onClick={() => notify({ type: 'habitDone' }, withUndo ? { undo: onUndo } : {})}>go</button>
    );
  }

  it('取り消し付きはスナックバーを5秒出し、取り消すで呼び出し側の取り消しを実行する', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    render(
      <FeedbackProvider>
        <Trigger withUndo onUndo={onUndo} />
      </FeedbackProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByTestId('snackbar')).toHaveTextContent(ja.feedback.recorded);
    expect(screen.getByRole('status')).toHaveTextContent(ja.feedback.recorded);
    act(() => vi.advanceTimersByTime(SNACKBAR_MS - 1));
    expect(screen.getByTestId('snackbar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ja.common.undo }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('snackbar')).toBeNull();
  });

  it('取り消しがなければフィードバックシートを1.2秒出して閉じる', () => {
    vi.useFakeTimers();
    render(
      <FeedbackProvider>
        <Trigger withUndo={false} />
      </FeedbackProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByTestId('feedback-sheet')).toHaveAttribute('data-variant', 'neutral');
    act(() => vi.advanceTimersByTime(FEEDBACK_SHEET_MS));
    expect(screen.queryByTestId('feedback-sheet')).toBeNull();
  });
});
