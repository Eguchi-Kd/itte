import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

interface Props {
  to: string;
  title: string;
  sub?: string;
}

/** 一覧の1行（§5.8）。左にタイトル、右に補足と矢印 */
export function ListRow({ to, title, sub }: Props) {
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-body">{title}</span>
      {sub && <span className="shrink-0 text-caption text-text-2">{sub}</span>}
      <ChevronRight size={20} strokeWidth={2.25} className="shrink-0 text-text-2" aria-hidden="true" />
    </Link>
  );
}
