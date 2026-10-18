import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface ChipProps {
  selected: boolean;
  onToggle: () => void;
  /** 単一選択なら radio、複数選択なら checkbox */
  multiple?: boolean;
  children: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}

export function ChoiceChip({ selected, onToggle, multiple = false, children, disabled, ariaLabel }: ChipProps) {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-full border-2 px-4 text-label ${
        selected ? 'border-primary bg-primary-tint text-text' : 'border-border bg-surface text-text'
      } disabled:opacity-50`}
    >
      {selected && <Check size={18} strokeWidth={2.25} aria-hidden="true" />}
      {children}
    </button>
  );
}

interface GroupProps {
  label: string;
  multiple?: boolean;
  children: ReactNode;
  className?: string;
}

export function ChipGroup({ label, multiple = false, children, className = '' }: GroupProps) {
  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {children}
    </div>
  );
}
