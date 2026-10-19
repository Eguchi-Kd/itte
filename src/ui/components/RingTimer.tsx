import { ja } from '../../copy/ja';
import { fill } from '../../copy/fill';
import { formatMmSs } from '../../domain/display';

interface Props {
  remainingMs: number;
  totalMs: number;
}

/** 円形の残り時間（§5.8）。リングは --accent、中央に timer の文字 */
export function RingTimer({ remainingMs, totalMs }: Props) {
  const r = 88;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));
  const mmss = formatMmSs(remainingMs);
  return (
    <div className="relative mx-auto size-60" role="timer" aria-label={fill(ja.start.timer.remaining, { mmss })}>
      <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-timer tabular-nums" data-testid="timer-text">
        {mmss}
      </span>
    </div>
  );
}
