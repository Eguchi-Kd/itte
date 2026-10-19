// 1日のしめ（§6.6.8、3問のレッスン）。同じ論理日に2回答えたら上書きする
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { saveDailyCheck } from '../../../db/repo/start';
import { logicalDate } from '../../../domain/dates';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { LessonShell } from '../../components/LessonShell';
import { NumberStepper } from '../../components/NumberStepper';
import { AUTO_ADVANCE_MS } from '../../components/ScaleInput';
import { useFeedback } from '../../feedback/FeedbackProvider';

const PRESETS = [0, 30, 60, 120, 180];

function YesNo({ label, value, onChoose }: { label: string; value: boolean | null; onChoose: (v: boolean) => void }) {
  return (
    <ChipGroup label={label} className="grid grid-cols-2">
      <ChoiceChip selected={value === true} onToggle={() => onChoose(true)}>
        {ja.start.yes}
      </ChoiceChip>
      <ChoiceChip selected={value === false} onToggle={() => onChoose(false)}>
        {ja.start.no}
      </ChoiceChip>
    </ChipGroup>
  );
}

export default function Daily() {
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [step, setStep] = useState(1);
  const [worry, setWorry] = useState<boolean | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const later = (fn: () => void) => setTimeout(fn, AUTO_ADVANCE_MS);
  const validMinutes = minutes !== null && Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440;

  const save = async (planned: boolean) => {
    if (worry === null || !validMinutes || busy) return;
    setBusy(true);
    try {
      const now = Date.now();
      await saveDailyCheck({ pendingWorry: worry, consumptionMin: minutes, plannedTaskExists: planned }, logicalDate(now), now);
      notify({ type: 'daily' });
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const title = step === 1 ? ja.start.worryQ : step === 2 ? ja.start.consumeQ : ja.start.plannedQ;
  return (
    <LessonShell
      step={step}
      total={3}
      title={title}
      onClose={() => navigate('/', { replace: true })}
      dirty={worry !== null}
      primaryLabel={step === 2 ? ja.common.next : undefined}
      primaryDisabled={!validMinutes}
      onPrimary={() => setStep(3)}
    >
      {step === 1 && (
        <YesNo
          label={ja.start.worryQ}
          value={worry}
          onChoose={(v) => {
            setWorry(v);
            later(() => setStep(2));
          }}
        />
      )}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-caption text-text-2">{ja.start.consumeHint}</p>
          <NumberStepper
            label={ja.start.consumeQ}
            value={minutes}
            onChange={setMinutes}
            min={0}
            max={1440}
            step={10}
            unit={ja.start.daily.minutes}
            decrementLabel={ja.common.decrement}
            incrementLabel={ja.common.increment}
          />
          <ChipGroup label={ja.start.consumeQ}>
            {PRESETS.map((p) => (
              <ChoiceChip
                key={p}
                selected={minutes === p}
                onToggle={() => {
                  setMinutes(p);
                  later(() => setStep(3));
                }}
              >
                {p}
              </ChoiceChip>
            ))}
          </ChipGroup>
        </div>
      )}
      {step === 3 && <YesNo label={ja.start.plannedQ} value={null} onChoose={(v) => void save(v)} />}
    </LessonShell>
  );
}
