// オンボーディング（§6.4）。1: はじめる、2〜6: タイプ診断（自動送り）、7: 入口の4択
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { completeOnboarding } from '../../../db/repo/common';
import { choosePersona, PERSONA_ORDER } from '../../../domain/persona';
import type { Persona } from '../../../domain/types';
import { EntryChoices, ENTRY_PATHS, type EntryTarget } from '../../components/EntryChoices';
import { LessonShell } from '../../components/LessonShell';
import { ScaleInput } from '../../components/ScaleInput';
import { useSettings } from '../../hooks/useSettings';
import { Koma } from '../../mascot/Koma';

const TOTAL = 7;

export default function Onboarding() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Partial<Record<Persona, number>>>({});
  const [skipped, setSkipped] = useState(false);
  const [pendingTo, setPendingTo] = useState<string | null>(null);

  // 設定の購読に onboarded=true が届いてから移る（届く前に移るとリダイレクトで戻されるため）
  useEffect(() => {
    if (pendingTo && settings?.onboarded) navigate(pendingTo, { replace: true });
  }, [pendingTo, settings?.onboarded, navigate]);

  const finish = async (to: string) => {
    const complete = !skipped && PERSONA_ORDER.every((p) => answers[p] !== undefined);
    const scores = complete ? (answers as Record<Persona, number>) : null;
    await completeOnboarding(scores, scores ? choosePersona(scores) : null, Date.now());
    setPendingTo(to);
  };

  const close = () => (settings?.onboarded ? navigate('/', { replace: true }) : setStep(1));

  if (step === 1) {
    return (
      <LessonShell
        step={1}
        total={TOTAL}
        title={ja.app.name}
        onClose={close}
        primaryLabel={ja.onboarding.start}
        onPrimary={() => setStep(2)}
      >
        <Koma pose="wave" />
        <p className="text-h2">{ja.koma.welcome}</p>
        <p className="text-body text-text-2">{ja.koma.privacy}</p>
      </LessonShell>
    );
  }

  if (step <= 6) {
    const persona = PERSONA_ORDER[step - 2];
    return (
      <LessonShell
        step={step}
        total={TOTAL}
        title={ja.onboarding.personaQ[persona]}
        onClose={close}
        topRight={
          <button
            type="button"
            className="min-h-12 min-w-12 px-2 text-label text-text-2"
            onClick={() => {
              setSkipped(true);
              setStep(7);
            }}
          >
            {ja.common.skip}
          </button>
        }
      >
        <ScaleInput
          key={persona}
          label={ja.onboarding.personaQ[persona]}
          value={answers[persona] ?? null}
          onChange={(v) => setAnswers((a) => ({ ...a, [persona]: v }))}
          onAdvance={() => setStep((s) => s + 1)}
        />
      </LessonShell>
    );
  }

  return (
    <LessonShell step={7} total={TOTAL} title={ja.onboarding.entryTitle} onClose={close}>
      <EntryChoices onChoose={(t: EntryTarget) => void finish(ENTRY_PATHS[t])} />
      <button
        type="button"
        className="mx-auto min-h-12 px-4 text-label text-text-2 underline"
        onClick={() => void finish('/')}
      >
        {ja.onboarding.entryLater}
      </button>
    </LessonShell>
  );
}
