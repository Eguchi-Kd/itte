interface Props {
  label: string;
  value: -2 | -1 | 0 | 1 | 2 | null;
  onChange: (v: -2 | -1 | 0 | 1 | 2 | null) => void;
}

const SCORES = [-2, -1, 0, 1, 2] as const;

/** −2〜+2 の5段階（読みシートの点数、§5.8）。0 が中央。もう一度押すと外す */
export function ScoreInput({ label, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
      {SCORES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(value === s ? null : s)}
          className={`h-12 min-w-12 rounded-2xl border-2 text-label ${value === s ? 'border-primary bg-primary-tint' : 'border-border bg-surface'}`}
        >
          {s > 0 ? `+${s}` : s}
        </button>
      ))}
    </div>
  );
}
