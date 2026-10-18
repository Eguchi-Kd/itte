// 習慣作成（§6.5.1、4ステップのレッスン）とペルソナ別の差分（§6.5.2）
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { saveHabit } from '../../../db/repo/habits';
import { formatIntention } from '../../../domain/habits/formatIntention';
import { normalizeHabitDraft, stepValid, validateHabitDraft } from '../../../domain/habits/validate';
import { LessonShell } from '../../components/LessonShell';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useSettings } from '../../hooks/useSettings';
import { KindFields, WhatFields, WhenFields } from './HabitFields';
import { draftFromForm, EMPTY_FORM, isDirty, type HabitForm } from './habitForm';

const TOTAL = 4;

export default function HabitWizard() {
  const navigate = useNavigate();
  const settings = useSettings();
  const { notify } = useFeedback();
  const persona = settings?.persona ?? null;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<HabitForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<HabitForm>) => setForm((f) => ({ ...f, ...patch }));

  const draft = useMemo(() => draftFromForm(form), [form]);
  const errors = useMemo(() => validateHabitDraft(draft, persona), [draft, persona]);
  const fieldsProps = { form, set, errors, persona };

  const valid = step === 4 ? true : step === 1 ? form.kind !== null && stepValid(errors, 1) : stepValid(errors, step);

  const save = async () => {
    setSaving(true);
    try {
      await saveHabit(draft, Date.now());
      notify({ type: 'habitDone' });
      navigate('/', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  // ペルソナで検証の規則が変わるので、設定が届くまでは描画しない
  if (settings === undefined) return null;

  const title =
    step === 1
      ? ja.habits.kindQ
      : step === 2
        ? form.kind === 'replace'
          ? ja.habits.replaceQ
          : ja.habits.whatQ
        : step === 3
          ? ja.habits.whenQ
          : ja.habits.confirmQ;

  return (
    <LessonShell
      step={step}
      total={TOTAL}
      title={title}
      onClose={() => navigate('/', { replace: true })}
      dirty={isDirty(form)}
      primaryLabel={step === 4 ? ja.habits.startWith : ja.common.next}
      primaryDisabled={!valid || saving}
      onPrimary={() => (step === 4 ? void save() : setStep((s) => (s + 1) as 2 | 3 | 4))}
    >
      {step === 1 && <KindFields {...fieldsProps} />}
      {step === 2 && <WhatFields {...fieldsProps} />}
      {step === 3 && <WhenFields {...fieldsProps} />}
      {step === 4 && (
        <p className="text-display" data-testid="intention">
          {formatIntention(normalizeHabitDraft(draft))}
        </p>
      )}
    </LessonShell>
  );
}
