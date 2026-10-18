import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../copy/ja';

interface Props {
  title: string;
  /** 戻り先。履歴がなければここへ */
  fallback: string;
  right?: ReactNode;
}

/** 通常の画面の見出し。左に戻る、右に補助の操作 */
export function ScreenHeader({ title, fallback, right }: Props) {
  const navigate = useNavigate();
  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
  return (
    <header className="flex items-center gap-2 pt-[max(8px,env(safe-area-inset-top))]">
      <button type="button" aria-label={ja.common.back} className="flex size-12 items-center justify-center rounded-2xl" onClick={back}>
        <ChevronLeft size={24} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-h1">{title}</h1>
      {right}
    </header>
  );
}
