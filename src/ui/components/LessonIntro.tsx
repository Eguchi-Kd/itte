import { useEffect, useState } from 'react';
import { ja } from '../../copy/ja';
import { fill } from '../../copy/fill';
import { markIntroSeen } from '../../db/repo/common';
import { useSettings } from '../hooks/useSettings';
import { Button } from './Button';

export type IntroId = 'habit' | 'task' | 'move' | 'goal' | 'judge' | 'weekly';

/**
 * 「はじめての○○」カード（§4.2 ガイドブックの移植）。そのレッスンを初めて開いたときだけ1枚出す。
 * 出した時点で introSeen に残し、閉じるか次のステップに進むまで表示を続ける
 */
export function LessonIntro({ id }: { id: IntroId }) {
  const settings = useSettings();
  const [shown, setShown] = useState<boolean | null>(null);
  useEffect(() => {
    if (shown !== null || !settings) return;
    const first = !settings.introSeen.includes(id);
    setShown(first);
    if (first) void markIntroSeen(id, Date.now());
  }, [settings, shown, id]);
  if (!shown) return null;
  const copy = ja.intro[id];
  return (
    <section className="card flex flex-col gap-2 p-4" data-testid={`intro-${id}`} aria-label={fill(ja.intro.label, { name: copy.name })}>
      <p className="text-label">{fill(ja.intro.label, { name: copy.name })}</p>
      <p className="text-body">{copy.body}</p>
      <Button size="sm" variant="secondary" className="self-start" onClick={() => setShown(false)}>
        {ja.intro.ok}
      </Button>
    </section>
  );
}
