import { ja } from '../../copy/ja';
import { CheckMark } from './FeedbackSheet';

interface Props {
  text: string;
  onUndo?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

/** 取り消し付きの通知（§5.8）。表示時間は呼び出し側が管理する（5秒） */
export function Snackbar({ text, onUndo, actionLabel, onAction }: Props) {
  return (
    <div
      className="fade-enter fixed inset-x-0 bottom-28 z-50 mx-auto flex max-w-[448px] items-center gap-3 rounded-2xl bg-text px-4 py-1 text-bg"
      data-testid="snackbar"
      data-variant="neutral"
    >
      <CheckMark size={24} />
      <span className="flex-1 text-label">{text}</span>
      {onUndo && (
        <button type="button" className="min-h-12 min-w-12 px-2 text-label underline" onClick={onUndo}>
          {ja.common.undo}
        </button>
      )}
      {actionLabel && onAction && (
        <button type="button" className="min-h-12 min-w-12 px-2 text-label underline" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
