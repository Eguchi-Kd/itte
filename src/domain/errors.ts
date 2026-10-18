// ドメインのエラー（§7.4）。UI は copyKey を src/copy/ja.ts で引いて表示する
export type DomainErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LIMIT_EXCEEDED'
  | 'PERIOD_OVERLAP'
  | 'IMMUTABLE'
  | 'ORDER_VIOLATION'
  | 'OUT_OF_WINDOW'
  | 'INTEGRITY';

export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    public copyKey: string,
    public detail?: unknown,
  ) {
    super(code);
    this.name = 'DomainError';
  }
}

export function isDomainError(e: unknown, code?: DomainErrorCode): e is DomainError {
  return e instanceof DomainError && (code === undefined || e.code === code);
}
