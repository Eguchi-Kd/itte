// 手番トリガー（§6.7.3）。有効なものは最大5件
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { copyByKey } from '../../../copy/fill';
import { queryBoardData } from '../../../db/queries/board';
import { saveTrigger, setTriggerActive } from '../../../db/repo/board';
import { isDomainError } from '../../../domain/errors';
import { Button } from '../../components/Button';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';

export default function TriggerSettings() {
  const data = useLiveQuery(() => queryBoardData(), []);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(copyByKey(isDomainError(e) ? e.copyKey : 'errors.unknown'));
    }
  };

  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="trigger-settings">
      <ScreenHeader title={ja.board.triggers.title} fallback="/board" />
      {data.triggers.length === 0 ? (
        <p className="text-caption text-text-2">{ja.board.triggers.empty}</p>
      ) : (
        <ul className="card p-0">
          {data.triggers.map((t) => (
            <li key={t.id} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-b-0">
              <span className="min-w-0 flex-1 text-body">{t.conditionText}</span>
              <button
                type="button"
                role="switch"
                aria-checked={t.active}
                aria-label={`${t.conditionText} ${ja.board.triggers.active}`}
                className={`flex h-12 min-w-16 items-center rounded-full border-2 px-1 ${t.active ? 'justify-end border-primary bg-primary' : 'justify-start border-border bg-surface-2'}`}
                onClick={() => void run(() => setTriggerActive(t.id, !t.active, Date.now()))}
              >
                <span className="size-8 rounded-full bg-surface" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-body">
          {error}
        </p>
      )}
      <TextField label={ja.board.triggers.condition} value={text} onChange={setText} maxLength={200} testId="trigger-text" />
      <ChipGroup label={ja.board.triggers.examples}>
        {ja.board.triggerExamples.map((ex) => (
          <ChoiceChip key={ex} selected={text === ex} onToggle={() => setText(ex)}>
            {ex}
          </ChoiceChip>
        ))}
      </ChipGroup>
      <Button
        disabled={text.trim().length === 0}
        onClick={() =>
          void run(async () => {
            const active = data.triggers.filter((t) => t.active).length < 5;
            await saveTrigger({ conditionText: text, active }, Date.now());
            setText('');
          })
        }
      >
        {ja.board.triggers.add}
      </Button>
    </main>
  );
}
