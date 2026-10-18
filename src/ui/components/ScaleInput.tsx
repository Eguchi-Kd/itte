import { useEffect, useRef } from 'react';
import { ja } from '../../copy/ja';
import { fill } from '../../copy/fill';

interface Props {
  value: number | null;
  onChange: (v: number) => void;
  /** 選んだ 250ms 後に呼ぶ */
  onAdvance?: () => void;
  label: string;
  lowLabel?: string;
  highLabel?: string;
}

export const AUTO_ADVANCE_MS = 250;

/** 1〜5 の5段階（§5.8） */
export function ScaleInput({ value, onChange, onAdvance, label, lowLabel = ja.onboarding.scaleLow, highLabel = ja.onboarding.scaleHigh }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const choose = (v: number) => {
    onChange(v);
    if (onAdvance) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onAdvance, AUTO_ADVANCE_MS);
    }
  };

  return (
    <div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={fill(ja.onboarding.scaleLabel, { n: v })}
            onClick={() => choose(v)}
            className={`h-14 min-w-12 rounded-2xl border-2 text-h2 ${
              value === v ? 'border-primary bg-primary-tint' : 'border-border bg-surface'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-caption text-text-2">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
