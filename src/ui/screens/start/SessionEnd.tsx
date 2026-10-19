// セッション終了（§6.6.6）。事実の要約と、「続ける」「やめる」を同じ大きさで並べる（U11）
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { querySession } from '../../../db/queries/start';
import { endSession, startSession } from '../../../db/repo/start';
import { sessionState, spentMinutes } from '../../../domain/start/session';
import type { Session } from '../../../domain/types';
import { Button } from '../../components/Button';
import { LessonShell } from '../../components/LessonShell';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useFlags } from '../../hooks/useFlags';
import { AffectInputs } from './StartTaskProvider';
import { useNow } from '../../hooks/useNow';

export default function SessionEnd() {
  const { id = '' } = useParams();
  const session = useLiveQuery(async () => (await querySession(id)) ?? null, [id]);
  if (session === undefined) return null;
  if (!session) {
    return (
      <main className="flex flex-col gap-4 px-4">
        <ScreenHeader title={ja.start.list.title} fallback="/" />
        <p className="text-body">{ja.start.timer.notFound}</p>
      </main>
    );
  }
  return <EndLesson session={session} />;
}

function EndLesson({ session }: { session: Session }) {
  const navigate = useNavigate();
  const now = useNow();
  const { roughStart } = useFlags();
  const { notify } = useFeedback();
  const [stopping, setStopping] = useState(false);
  const [nextStep, setNextStep] = useState('');
  const [busy, setBusy] = useState(false);
  const [actualIntensity, setActualIntensity] = useState<number | null>(null);
  const [actualDuration, setActualDuration] = useState<number | null>(null);
  // 感情予想を記録していた場合だけ、実際の値を聞く（任意）
  const asksAffect = session.affectPredictionId !== null;
  const affectActual =
    asksAffect && actualIntensity !== null && actualDuration !== null ? { intensity: actualIntensity, durationMin: actualDuration } : null;
  // 次の一手は B 条件で始めたセッションでだけ聞く（A 条件では入力欄を出さない）
  const asksNext = session.roughMode;
  const valid = !asksNext || nextStep.trim().length > 0;

  const keepGoing = async () => {
    setBusy(true);
    try {
      const nextId =
        sessionState(session, Date.now()) === 'closed'
          ? (await startSession(session.taskId, roughStart, null, Date.now())).id
          : await endSession(session.id, 'continue', null, affectActual, Date.now());
      if (nextId) navigate(`/session/${nextId}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await endSession(session.id, 'stop', asksNext ? nextStep : null, affectActual, Date.now());
      notify({ type: 'saved' });
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <LessonShell
      step={1}
      total={1}
      title={fill(ja.start.spent, { n: spentMinutes(session, now) })}
      onClose={() => navigate('/', { replace: true })}
      dirty={nextStep.trim().length > 0}
      primaryLabel={stopping ? ja.common.confirm : undefined}
      primaryDisabled={!valid || busy}
      onPrimary={() => void stop()}
    >
      {asksAffect && (
        <div data-testid="affect-actual">
          <AffectInputs
            intensity={actualIntensity}
            duration={actualDuration}
            onIntensity={setActualIntensity}
            onDuration={setActualDuration}
            intensityLabel={ja.start.affectActualQ}
            durationLabel={ja.start.affectActualDurQ}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => void keepGoing()}>
          {ja.start.continue}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          aria-pressed={stopping}
          className={stopping ? 'border-primary' : ''}
          disabled={busy}
          onClick={() => (asksNext ? setStopping(true) : void stop())}
        >
          {ja.start.stop}
        </Button>
      </div>
      {stopping && asksNext && (
        <TextField
          label={ja.start.nextQ}
          hint={ja.start.nextHint}
          value={nextStep}
          onChange={setNextStep}
          maxLength={80}
          testId="next-step"
        />
      )}
    </LessonShell>
  );
}
