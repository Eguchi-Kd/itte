import { Button } from './Button';
import { ja } from '../../copy/ja';

interface Props {
  text: string;
  onNext: () => void;
  nextLabel?: string;
}

/** 記録直後に下から出る帯（§5.8）。結果によって見た目を変えない */
export function FeedbackSheet({ text, onNext, nextLabel = ja.common.next }: Props) {
  return (
    <div
      className="sheet-enter bottom-actions fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] rounded-t-3xl bg-primary-tint px-4 pt-4"
      data-testid="feedback-sheet"
      data-variant="neutral"
    >
      <div className="mb-3 flex items-center gap-3">
        <CheckMark />
        <p className="text-h2">{text}</p>
      </div>
      <Button size="lg" block onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}

export function CheckMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-primary">
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15" />
      <path
        className="check-draw"
        d="M6.5 12.5l3.5 3.5 7.5-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
