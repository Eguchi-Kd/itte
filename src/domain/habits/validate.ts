// 習慣の入力の検証（§6.5.1、§6.5.2、§7.2）。作成ウィザード・編集画面・リポジトリで同じ規則を使う
import type { Habit, Persona } from '../types';

export type HabitDraft = Pick<
  Habit,
  | 'kind'
  | 'name'
  | 'replacesText'
  | 'purpose'
  | 'unit'
  | 'amount'
  | 'minAmount'
  | 'schedule'
  | 'place'
  | 'how'
  | 'commitmentNote'
  | 'funNote'
>;

export type HabitField =
  | 'replacesText'
  | 'name'
  | 'purpose'
  | 'unit'
  | 'amount'
  | 'minAmount'
  | 'days'
  | 'timeOrCue'
  | 'time'
  | 'cue'
  | 'place'
  | 'how'
  | 'commitmentNote'
  | 'funNote';

export interface FieldError {
  copyKey: string;
  n?: number;
}

export type HabitErrors = Partial<Record<HabitField, FieldError>>;

/** ウィザードの各ステップで検査する項目 */
export const STEP_FIELDS: Record<1 | 2 | 3, HabitField[]> = {
  1: ['replacesText'],
  2: ['name', 'purpose', 'unit', 'amount', 'minAmount'],
  3: ['days', 'timeOrCue', 'time', 'cue', 'place', 'how', 'commitmentNote', 'funNote'],
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(value: string | null, min: number, max: number): FieldError | undefined {
  const len = (value ?? '').trim().length;
  if (len < min) return { copyKey: 'errors.required' };
  if (len > max) return { copyKey: 'errors.tooLong', n: max };
  return undefined;
}

export function validateHabitDraft(d: HabitDraft, persona: Persona | null): HabitErrors {
  const e: HabitErrors = {};
  const set = (f: HabitField, v: FieldError | undefined) => {
    if (v) e[f] = v;
  };

  if (d.kind === 'replace') set('replacesText', text(d.replacesText, 1, 40));
  set('name', text(d.name, 1, 40));
  set('purpose', text(d.purpose, persona === 'meaning' ? 1 : 0, 200));
  set('unit', text(d.unit, 1, 10));
  if (!Number.isInteger(d.amount) || d.amount < 1) set('amount', { copyKey: 'errors.positiveInt' });
  if (!Number.isInteger(d.minAmount) || d.minAmount < 1 || (Number.isInteger(d.amount) && d.minAmount > d.amount)) {
    set('minAmount', { copyKey: 'errors.minAmountRange' });
  }

  const days = new Set(d.schedule.days);
  if (days.size === 0 || [...days].some((x) => !Number.isInteger(x) || x < 0 || x > 6)) {
    set('days', { copyKey: 'errors.daysRequired' });
  }
  const time = d.schedule.time?.trim() ?? '';
  const cue = d.schedule.cue?.trim() ?? '';
  if (!time && !cue) set('timeOrCue', { copyKey: 'errors.timeOrCue' });
  if (time && !TIME_RE.test(time)) set('time', { copyKey: 'errors.required' });
  if (cue) set('cue', text(cue, 1, 40));
  set('place', text(d.place, 1, 40));
  set('how', text(d.how, 0, 80));
  set('commitmentNote', text(d.commitmentNote, persona === 'regret' ? 1 : 0, 200));
  set('funNote', text(d.funNote, 0, 200));
  return e;
}

export function stepValid(errors: HabitErrors, step: 1 | 2 | 3): boolean {
  return STEP_FIELDS[step].every((f) => !errors[f]);
}

/** 保存の前に前後の空白を除き、空の任意項目を null にそろえる */
export function normalizeHabitDraft(d: HabitDraft): HabitDraft {
  const opt = (s: string | null) => {
    const t = (s ?? '').trim();
    return t === '' ? null : t;
  };
  return {
    ...d,
    name: d.name.trim(),
    replacesText: d.kind === 'replace' ? opt(d.replacesText) : null,
    purpose: d.purpose.trim(),
    unit: d.unit.trim(),
    schedule: {
      days: [...new Set(d.schedule.days)].sort((a, b) => a - b),
      time: opt(d.schedule.time),
      cue: opt(d.schedule.cue),
    },
    place: d.place.trim(),
    how: d.how.trim(),
    commitmentNote: opt(d.commitmentNote),
    funNote: opt(d.funNote),
  };
}
