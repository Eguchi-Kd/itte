import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { ChoiceChip, ChipGroup } from './ChoiceChip';

interface Props {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  presets?: number[];
  unit?: string;
  decrementLabel: string;
  incrementLabel: string;
}

/** −／＋ボタンと数値。定番値のチップ（§5.8） */
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  presets,
  unit,
  decrementLabel,
  incrementLabel,
}: Props) {
  const id = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={decrementLabel}
          className="btn btn-secondary size-12"
          onClick={() => onChange(clamp((value ?? min) - step))}
        >
          <Minus size={20} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <input
          id={id}
          inputMode="numeric"
          className="h-12 w-24 rounded-2xl border-2 border-border bg-surface-2 px-3 text-center text-h2"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            onChange(raw === '' ? null : clamp(Number(raw)));
          }}
        />
        {unit && <span className="text-body text-text-2">{unit}</span>}
        <button
          type="button"
          aria-label={incrementLabel}
          className="btn btn-secondary size-12"
          onClick={() => onChange(clamp((value ?? min) + step))}
        >
          <Plus size={20} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
      {presets && (
        <ChipGroup label={label}>
          {presets.map((p) => (
            <ChoiceChip key={p} selected={value === p} onToggle={() => onChange(p)}>
              {p}
            </ChoiceChip>
          ))}
        </ChipGroup>
      )}
    </div>
  );
}
