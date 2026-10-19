// 定跡（§6.7.7）。追加・編集・非表示（削除の代わり）
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { queryJoseki } from '../../../db/queries/board';
import { saveJoseki } from '../../../db/repo/board';
import type { Joseki } from '../../../domain/types';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';

export default function JosekiList() {
  const list = useLiveQuery(() => queryJoseki(), []);
  const [text, setText] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  if (!list) return null;
  const items = list.filter((j) => showHidden || !j.archived);

  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="joseki-list">
      <ScreenHeader title={ja.board.josekiList.title} fallback="/library" />
      {items.length === 0 ? (
        <p className="text-caption text-text-2">{ja.board.josekiList.empty}</p>
      ) : (
        <ul className="card p-0">
          {items.map((j) =>
            editing === j.id ? (
              <li key={j.id} className="p-3">
                <EditRow joseki={j} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={j.id} className="flex min-h-14 items-center gap-2 border-b border-border px-4 last:border-b-0">
                <span className={`min-w-0 flex-1 text-body ${j.archived ? 'text-text-2' : ''}`}>{j.principle}</span>
                <Button size="sm" variant="ghost" onClick={() => setEditing(j.id)}>
                  {ja.board.edit}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void saveJoseki({ id: j.id, principle: j.principle, archived: !j.archived }, Date.now())}>
                  {j.archived ? ja.board.josekiList.show : ja.board.josekiList.hide}
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
      <Toggle label={ja.board.josekiList.showHidden} checked={showHidden} onChange={setShowHidden} />
      <TextField label={ja.board.josekiList.principle} value={text} onChange={setText} maxLength={100} testId="joseki-text" />
      <Button
        disabled={text.trim().length === 0}
        onClick={async () => {
          await saveJoseki({ principle: text }, Date.now());
          setText('');
        }}
      >
        {ja.board.josekiList.add}
      </Button>
    </main>
  );
}

function EditRow({ joseki, onDone }: { joseki: Joseki; onDone: () => void }) {
  const [text, setText] = useState(joseki.principle);
  return (
    <div className="flex flex-col gap-2">
      <TextField label={ja.board.josekiList.principle} value={text} onChange={setText} maxLength={100} />
      <Button
        disabled={text.trim().length === 0}
        onClick={async () => {
          await saveJoseki({ id: joseki.id, principle: text }, Date.now());
          onDone();
        }}
      >
        {ja.board.josekiList.save}
      </Button>
    </div>
  );
}
