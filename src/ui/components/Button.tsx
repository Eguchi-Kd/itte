import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ja } from '../../copy/ja';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  children: ReactNode;
}

// sm は見た目 40px だが、当たり判定は 48px を確保する（X3）
const HEIGHT: Record<ButtonSize, string> = { lg: 'h-14', md: 'h-12', sm: 'h-10 my-1' };

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${HEIGHT[size]} ${size === 'sm' ? 'min-w-12 text-caption' : 'min-w-12'} ${
        block ? 'w-full' : ''
      } relative ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={loading ? 'invisible' : ''}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-label={ja.common.loading}>
          <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
        </span>
      )}
    </button>
  );
}
