// 記録庫（§6.11）。M1 では習慣の一覧への入口と設定のアイコン。ほかの一覧は各モジュールのタスクで足す
import { Settings as SettingsIcon } from 'lucide-react';
import { Link } from 'react-router';
import { ja } from '../../../copy/ja';
import { ListRow } from '../../components/ListRow';

export default function Library() {
  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(12px,env(safe-area-inset-top))]" data-testid="library">
      <header className="flex items-center justify-between">
        <h1 className="text-h1">{ja.nav.library}</h1>
        <Link to="/settings" aria-label={ja.common.settings} className="flex size-12 items-center justify-center rounded-2xl text-text-2">
          <SettingsIcon size={24} strokeWidth={2.25} aria-hidden="true" />
        </Link>
      </header>
      <div className="card p-0">
        <ListRow to="/library/habits" title={ja.habits.list.title} />
        <ListRow to="/library/tasks" title={ja.start.list.title} />
        <ListRow to="/library/moves" title={ja.board.move.listTitle} />
        <ListRow to="/library/joseki" title={ja.board.josekiList.title} />
        <ListRow to="/settings/triggers" title={ja.board.triggers.title} />
        <ListRow to="/settings/evaluation" title={ja.board.evalForm.title} />
      </div>
    </main>
  );
}
