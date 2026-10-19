// 10分タイマー（§6.6.4）と詰まりシート（§6.6.5）。残り時間は state に持たず、startedAt から毎秒計算する
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { querySession, queryTaskDetail } from '../../../db/queries/start';
import { interruptSession, recordStuck } from '../../../db/repo/start';
import { formatMmSs } from '../../../domain/display';
import { remainingMs, SESSION_MS, sessionState } from '../../../domain/start/session';
import type { Session, StuckChoice, Task } from '../../../domain/types';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { RingTimer } from '../../components/RingTimer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { vibrate } from '../../feedback/haptics';
import { playSound } from '../../feedback/sound';
import { useFlags } from '../../hooks/useFlags';
import { useNow } from '../../hooks/useNow';
import { useSettings } from '../../hooks/useSettings';
import { useWakeLock } from '../../hooks/useWakeLock';
import { APP_NAME } from '../../../config';

export default function SessionTimer() {
  const { id = '' } = useParams();
  const session = useLiveQuery(async () => (await querySession(id)) ?? null, [id]);
  const task = useLiveQuery(
    async () => (session ? (await queryTaskDetail(session.taskId)).task : undefined),
    [session?.taskId],
  );
  if (session === undefined || (session && task === undefined)) return null;
  if (!session || !task) {
    return (
      <main className="flex flex-col gap-4 px-4">
        <ScreenHeader title={ja.start.list.title} fallback="/" />
        <p className="text-body">{ja.start.timer.notFound}</p>
      </main>
    );
  }
  return <Timer session={session} task={task} />;
}

function Timer({ session, task }: { session: Session; task: Task }) {
  const navigate = useNavigate();
  const now = useNow(1000);
  const settings = useSettings();
  const flags = useFlags();
  const { notify } = useFeedback();
  const [stuckOpen, setStuckOpen] = useState(false);
  const [blocker, setBlocker] = useState('');
  const ended = useRef(false);
  const remaining = remainingMs(session, now);
  const state = sessionState(session, now);
  const endPath = `/session/${session.id}/end`;

  useWakeLock(state === 'running');

  // タブのタイトルを「6:12 一手」の形で毎秒更新する
  useEffect(() => {
    document.title = fill(ja.start.timer.docTitle, { mmss: formatMmSs(remaining), app: APP_NAME });
  }, [remaining]);
  useEffect(
    () => () => {
      document.title = APP_NAME;
    },
    [],
  );

  // 0:00 で音と振動を出して終了画面へ。閉じたセッションも終了画面へ（バックグラウンドで過ぎた場合は前面に戻った時点）
  useEffect(() => {
    if (ended.current || state === 'running') return;
    ended.current = true;
    if (state === 'ending') {
      if (settings?.soundOn ?? true) playSound('timerEnd');
      if (settings?.hapticsOn ?? true) vibrate('timerEnd');
    }
    navigate(endPath, { replace: true });
  }, [state, endPath, navigate, settings]);

  const choose = async (choice: StuckChoice) => {
    const effects = await recordStuck(session.id, blocker, choice, Date.now());
    setStuckOpen(false);
    setBlocker('');
    if (choice === 'stop') {
      ended.current = true;
      notify({ type: 'stuck', stopped: true });
      if (effects.goTo === 'end') navigate(endPath, { replace: true });
    } else {
      notify({ type: 'stuck' });
    }
  };

  const focus = flags.roughStart && task.firstAction ? task.firstAction : task.title;
  const canStuck = blocker.trim().length > 0;

  return (
    <main className="app-column flex flex-col items-center gap-8 px-4 pt-[max(24px,env(safe-area-inset-top))]" data-testid="session-timer">
      <RingTimer remainingMs={remaining} totalMs={SESSION_MS} />
      <p className="text-center text-h1" data-testid="timer-focus">
        {focus}
      </p>
      <div className="bottom-actions mt-auto flex w-full flex-col gap-2">
        {flags.roughStart && (
          <Button size="lg" block variant="secondary" onClick={() => setStuckOpen(true)}>
            {ja.start.stuck}
          </Button>
        )}
        <Button
          size="lg"
          block
          variant="ghost"
          onClick={async () => {
            ended.current = true;
            await interruptSession(session.id, Date.now());
            navigate(endPath, { replace: true });
          }}
        >
          {ja.start.interrupt}
        </Button>
      </div>
      <BottomSheet open={stuckOpen} onClose={() => setStuckOpen(false)} title={ja.start.stuckQ} testId="stuck-sheet">
        <div className="flex flex-col gap-3 pb-2">
          <TextField label={ja.start.timer.blocker} value={blocker} onChange={setBlocker} maxLength={80} testId="stuck-blocker" />
          <div role="group" aria-label={ja.start.timer.stuckChoices} className="flex flex-col gap-2">
            {(
              [
                ['fill', ja.start.fill],
                ['research5', ja.start.research5],
                ['stop', ja.start.stopWithNext],
              ] as const
            ).map(([choice, label]) => (
              <Button key={choice} size="lg" block variant="secondary" disabled={!canStuck} onClick={() => void choose(choice)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </main>
  );
}
