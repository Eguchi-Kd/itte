import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

interface Props {
  text: string;
  to: string;
}

/** 画面上部の細い帯（§5.8） */
export function Banner({ text, to }: Props) {
  return (
    <Link to={to} className="flex min-h-12 items-center justify-between gap-2 rounded-2xl bg-surface-2 px-4 text-label">
      <span>{text}</span>
      <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" />
    </Link>
  );
}
