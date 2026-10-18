// 習慣の作成・編集の入力状態
import type { HabitDraft } from '../../../domain/habits/validate';
import type { Habit, HabitKind } from '../../../domain/types';

export interface HabitForm {
  kind: HabitKind | null;
  replacesText: string;
  name: string;
  purpose: string;
  unit: string;
  amount: number | null;
  minAmount: number | null;
  days: number[];
  time: string;
  cue: string;
  place: string;
  how: string;
  commitmentNote: string;
  funNote: string;
}

export const EMPTY_FORM: HabitForm = {
  kind: null,
  replacesText: '',
  name: '',
  purpose: '',
  unit: '',
  amount: null,
  minAmount: null,
  days: [0, 1, 2, 3, 4, 5, 6],
  time: '',
  cue: '',
  place: '',
  how: '',
  commitmentNote: '',
  funNote: '',
};

export function formFromHabit(h: Habit): HabitForm {
  return {
    kind: h.kind,
    replacesText: h.replacesText ?? '',
    name: h.name,
    purpose: h.purpose,
    unit: h.unit,
    amount: h.amount,
    minAmount: h.minAmount,
    days: [...h.schedule.days],
    time: h.schedule.time ?? '',
    cue: h.schedule.cue ?? '',
    place: h.place,
    how: h.how,
    commitmentNote: h.commitmentNote ?? '',
    funNote: h.funNote ?? '',
  };
}

export function draftFromForm(f: HabitForm): HabitDraft {
  return {
    kind: f.kind ?? 'build',
    name: f.name,
    replacesText: f.kind === 'replace' ? f.replacesText : null,
    purpose: f.purpose,
    unit: f.unit,
    amount: f.amount ?? 0,
    minAmount: f.minAmount ?? 0,
    schedule: { days: f.days, time: f.time || null, cue: f.cue || null },
    place: f.place,
    how: f.how,
    commitmentNote: f.commitmentNote || null,
    funNote: f.funNote || null,
  };
}

export function isDirty(f: HabitForm, initial: HabitForm = EMPTY_FORM): boolean {
  return JSON.stringify(f) !== JSON.stringify(initial);
}
