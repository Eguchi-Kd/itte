// 習慣の入力欄（作成ウィザードと編集画面で共通）
import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { weekdayLabel } from '../../../domain/display';
import { smallStartSuggestion } from '../../../domain/habits/guards';
import type { HabitErrors } from '../../../domain/habits/validate';
import type { HabitKind, Persona } from '../../../domain/types';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { NumberStepper } from '../../components/NumberStepper';
import { errorText, TextField } from '../../components/TextField';
import type { HabitForm } from './habitForm';

interface FieldsProps {
  form: HabitForm;
  set: (patch: Partial<HabitForm>) => void;
  errors: HabitErrors;
  persona: Persona | null;
}

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const PRESETS: { key: keyof typeof ja.habits.dayPresets; days: number[] }[] = [
  { key: 'everyday', days: [0, 1, 2, 3, 4, 5, 6] },
  { key: 'weekdays', days: [1, 2, 3, 4, 5] },
  { key: 'weekend', days: [0, 6] },
];

const sameDays = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** ステップ1: 始めたい／やめたい */
export function KindFields({ form, set, errors }: FieldsProps) {
  const choose = (kind: HabitKind) => set({ kind });
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={ja.habits.kindQ} className="grid grid-cols-2 gap-3">
        {(['build', 'replace'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={form.kind === k}
            onClick={() => choose(k)}
            className={`card min-h-24 p-4 text-h2 ${form.kind === k ? 'border-primary bg-primary-tint' : ''}`}
          >
            {k === 'build' ? ja.habits.build : ja.habits.replace}
          </button>
        ))}
      </div>
      {form.kind === 'replace' && (
        <TextField
          label={ja.habits.field.replacesText}
          value={form.replacesText}
          onChange={(v) => set({ replacesText: v })}
          maxLength={40}
          error={form.replacesText ? errors.replacesText : undefined}
        />
      )}
    </div>
  );
}

/** ステップ2: 行動と量 */
export function WhatFields({ form, set, errors, persona }: FieldsProps) {
  const units = ja.habits.units as readonly string[];
  const [otherUnit, setOtherUnit] = useState(form.unit !== '' && !units.includes(form.unit));
  const suggestion =
    form.amount !== null && form.minAmount !== null && form.minAmount >= 1 && form.minAmount <= form.amount
      ? smallStartSuggestion(form.amount, form.minAmount, persona)
      : null;
  const purposeRequired = persona === 'meaning';

  return (
    <div className="flex flex-col gap-5">
      <TextField
        label={ja.habits.field.name}
        value={form.name}
        onChange={(v) => set({ name: v })}
        maxLength={40}
        testId="habit-name"
      />
      <TextField
        label={purposeRequired ? ja.habits.field.purpose : `${ja.habits.field.purpose}${ja.common.optional}`}
        value={form.purpose}
        onChange={(v) => set({ purpose: v })}
        maxLength={200}
        testId="habit-purpose"
      />
      <div className="flex flex-col gap-2">
        <span className="text-label" id="unit-label">
          {ja.habits.field.unit}
        </span>
        <ChipGroup label={ja.habits.field.unit}>
          {units.map((u) => (
            <ChoiceChip
              key={u}
              selected={!otherUnit && form.unit === u}
              onToggle={() => {
                setOtherUnit(false);
                set({ unit: u });
              }}
            >
              {u}
            </ChoiceChip>
          ))}
          <ChoiceChip
            selected={otherUnit}
            onToggle={() => {
              setOtherUnit(true);
              set({ unit: '' });
            }}
          >
            {ja.habits.unitOtherChip}
          </ChoiceChip>
        </ChipGroup>
        {otherUnit && (
          <TextField
            label={ja.habits.field.unitOther}
            value={form.unit}
            onChange={(v) => set({ unit: v })}
            maxLength={10}
          />
        )}
      </div>
      <NumberStepper
        label={ja.habits.field.amount}
        value={form.amount}
        onChange={(v) => set({ amount: v })}
        min={1}
        unit={form.unit || undefined}
        decrementLabel={`${ja.habits.field.amount} ${ja.common.decrement}`}
        incrementLabel={`${ja.habits.field.amount} ${ja.common.increment}`}
      />
      {form.amount !== null && errors.amount && <p className="text-caption">{errorText(errors.amount)}</p>}
      <div className="flex flex-col gap-1">
        <NumberStepper
          label={ja.habits.field.minAmount}
          value={form.minAmount}
          onChange={(v) => set({ minAmount: v })}
          min={1}
          unit={form.unit || undefined}
          decrementLabel={`${ja.habits.field.minAmount} ${ja.common.decrement}`}
          incrementLabel={`${ja.habits.field.minAmount} ${ja.common.increment}`}
        />
        <p className="text-caption text-text-2">{ja.habits.field.minAmountHint}</p>
        {form.minAmount !== null && errors.minAmount && (
          <p className="text-caption" role="alert">
            {errorText(errors.minAmount)}
          </p>
        )}
      </div>
      {suggestion !== null && (
        <div className="card flex flex-col gap-2 bg-surface-2 p-4" data-testid="small-start">
          <p className="text-body">{fill(ja.habits.smallStart, { n: suggestion, unit: form.unit })}</p>
          <div>
            <ChoiceChip selected={false} onToggle={() => set({ amount: suggestion })}>
              {ja.habits.smallStartAccept}
            </ChoiceChip>
          </div>
        </div>
      )}
    </div>
  );
}

/** ステップ3: いつ・どこで */
export function WhenFields({ form, set, errors, persona }: FieldsProps) {
  const toggleDay = (d: number) =>
    set({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-label">{ja.habits.field.days}</span>
        <ChipGroup label={ja.habits.field.days} multiple>
          {PRESETS.map((p) => (
            <ChoiceChip key={p.key} multiple selected={sameDays(form.days, p.days)} onToggle={() => set({ days: p.days })}>
              {ja.habits.dayPresets[p.key]}
            </ChoiceChip>
          ))}
        </ChipGroup>
        <ChipGroup label={ja.habits.field.days} multiple className="gap-1">
          {MONDAY_FIRST.map((d) => (
            <ChoiceChip key={d} multiple selected={form.days.includes(d)} onToggle={() => toggleDay(d)}>
              {weekdayLabel(d)}
            </ChoiceChip>
          ))}
        </ChipGroup>
        {errors.days && <p className="text-caption">{errorText(errors.days)}</p>}
      </div>
      <p className="text-caption text-text-2">{ja.habits.field.timeOrCue}</p>
      <TextField
        label={ja.habits.field.time}
        type="time"
        value={form.time}
        onChange={(v) => set({ time: v })}
        maxLength={5}
        testId="habit-time"
      />
      <TextField
        label={ja.habits.field.cue}
        hint={ja.habits.field.cueHint}
        value={form.cue}
        onChange={(v) => set({ cue: v })}
        maxLength={40}
        testId="habit-cue"
      />
      <TextField
        label={ja.habits.field.place}
        value={form.place}
        onChange={(v) => set({ place: v })}
        maxLength={40}
        testId="habit-place"
      />
      <TextField
        label={`${ja.habits.field.how}${ja.common.optional}`}
        value={form.how}
        onChange={(v) => set({ how: v })}
        maxLength={80}
      />
      <TextField
        label={persona === 'regret' ? ja.habits.field.commitmentNote : `${ja.habits.field.commitmentNote}${ja.common.optional}`}
        hint={ja.habits.field.commitmentHint}
        value={form.commitmentNote}
        onChange={(v) => set({ commitmentNote: v })}
        maxLength={200}
        testId="habit-commitment"
      />
      {persona === 'notfun' && (
        <TextField
          label={`${ja.habits.field.funNote}${ja.common.optional}`}
          hint={ja.habits.field.funHint}
          value={form.funNote}
          onChange={(v) => set({ funNote: v })}
          maxLength={200}
          testId="habit-fun"
        />
      )}
    </div>
  );
}
