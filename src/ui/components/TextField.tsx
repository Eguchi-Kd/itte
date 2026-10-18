import { useId } from 'react';
import { copyByKey, fill } from '../../copy/fill';
import type { FieldError } from '../../domain/habits/validate';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  hint?: string;
  error?: FieldError;
  type?: 'text' | 'time';
  testId?: string;
}

export function errorText(e: FieldError | undefined): string | null {
  if (!e) return null;
  return fill(copyByKey(e.copyKey), { n: e.n ?? '' });
}

/** 1行の入力欄（X6）。ラベル・補足・エラー文を持つ */
export function TextField({ label, value, onChange, maxLength, hint, error, type = 'text', testId }: Props) {
  const id = useId();
  const msg = errorText(error);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-caption text-text-2">
          {hint}
        </p>
      )}
      <input
        id={id}
        type={type}
        value={value}
        maxLength={type === 'text' ? maxLength : undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={msg ? true : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        data-testid={testId}
        className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-3 text-body"
      />
      {msg && (
        <p className="text-caption text-text" role="alert">
          {msg}
        </p>
      )}
    </div>
  );
}
