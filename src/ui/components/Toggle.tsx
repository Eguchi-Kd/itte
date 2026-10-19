interface Props {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}

/** オン／オフのトグル（role=switch）。文字でも状態がわかるよう、ラベルを並べる */
export function Toggle({ label, checked, onChange, testId }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border-2 border-border bg-surface px-4 text-body"
    >
      <span>{label}</span>
      <span
        className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 ${checked ? 'justify-end bg-primary' : 'justify-start bg-surface-2'}`}
        aria-hidden="true"
      >
        <span className="size-6 rounded-full bg-surface shadow-sm" />
      </span>
    </button>
  );
}
