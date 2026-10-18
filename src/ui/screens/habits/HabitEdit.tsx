// 習慣の編集（§6.5.4）。作成ウィザードと同じ項目を1ページのフォームで出す。量を変えたら amountChangedOn を今日にする（saveHabit）
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { queryHabit } from '../../../db/queries/habits';
import { saveHabit } from '../../../db/repo/habits';
import { validateHabitDraft } from '../../../domain/habits/validate';
import type { Habit, Persona } from '../../../domain/types';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useSettings } from '../../hooks/useSettings';
import { KindFields, WhatFields, WhenFields } from './HabitFields';
import { draftFromForm, formFromHabit, type HabitForm } from './habitForm';

export default function HabitEdit() {
  const { id = '' } = useParams();
  const habit = useLiveQuery(async () => (await queryHabit(id)) ?? null, [id]);
  const settings = useSettings();
  if (habit === undefined || settings === undefined) return null;
  if (habit === null) {
    return (
      <main className="flex flex-col gap-4 px-4">
        <ScreenHeader title={ja.habits.edit.title} fallback="/library/habits" />
        <p className="text-body">{ja.habits.detail.notFound}</p>
      </main>
    );
  }
  return <EditForm habit={habit} persona={settings?.persona ?? null} />;
}

function EditForm({ habit, persona }: { habit: Habit; persona: Persona | null }) {
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [form, setForm] = useState<HabitForm>(() => formFromHabit(habit));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<HabitForm>) => setForm((f) => ({ ...f, ...patch }));
  const draft = useMemo(() => draftFromForm(form), [form]);
  const errors = useMemo(() => validateHabitDraft(draft, persona), [draft, persona]);
  const props = { form, set, errors, persona };
  const valid = Object.keys(errors).length === 0;

  return (
    <main className="flex flex-col gap-6 px-4 pb-8" data-testid="habit-edit">
      <ScreenHeader title={ja.habits.edit.title} fallback={`/habits/${habit.id}`} />
      <KindFields {...props} />
      <WhatFields {...props} />
      <WhenFields {...props} />
      <div className="bottom-actions sticky bottom-0 bg-bg pt-3">
        <Button
          size="lg"
          block
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await saveHabit({ ...draft, id: habit.id }, Date.now());
              notify({ type: 'saved' });
              navigate(`/habits/${habit.id}`, { replace: true });
            } finally {
              setSaving(false);
            }
          }}
        >
          {ja.habits.edit.save}
        </Button>
      </div>
    </main>
  );
}
