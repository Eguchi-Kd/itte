import { BookOpen, Grid3x3, Plus, Route, RotateCcw } from 'lucide-react';
import { NavLink } from 'react-router';
import { ja } from '../../copy/ja';

interface Props {
  onAdd: () => void;
}

const TAB = 'flex min-h-14 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 text-caption';

function tabClass({ isActive }: { isActive: boolean }) {
  return `${TAB} ${isActive ? 'text-primary' : 'text-text-2'}`;
}

/** 下部タブ（§5.8）。「きょう」「盤面」「＋」「ふりかえり」「記録庫」 */
export function BottomNav({ onAdd }: Props) {
  return (
    <nav
      aria-label={ja.nav.label}
      data-testid="bottom-nav"
      className="bottom-actions fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] items-end border-t border-border bg-surface px-2 pt-1"
    >
      <NavLink to="/" end className={tabClass}>
        <Route size={24} strokeWidth={2.25} aria-hidden="true" />
        {ja.nav.today}
      </NavLink>
      <NavLink to="/board" className={tabClass}>
        <Grid3x3 size={24} strokeWidth={2.25} aria-hidden="true" />
        {ja.nav.board}
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          aria-label={ja.nav.add}
          onClick={onAdd}
          className="btn btn-primary -mt-4 size-14 rounded-full p-0"
          data-testid="nav-add"
        >
          <Plus size={28} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
      <NavLink to="/review" className={tabClass}>
        <RotateCcw size={24} strokeWidth={2.25} aria-hidden="true" />
        {ja.nav.review}
      </NavLink>
      <NavLink to="/library" className={tabClass}>
        <BookOpen size={24} strokeWidth={2.25} aria-hidden="true" />
        {ja.nav.library}
      </NavLink>
    </nav>
  );
}
