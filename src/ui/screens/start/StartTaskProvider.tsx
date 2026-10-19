// やることの開始（感情予想の開始前シートつき、§6.6.3、D36）。シートはその段につき1日1回まで
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryAffectContext } from '../../../db/queries/start';
import { updateSettings } from '../../../db/repo/common';
import { startSession } from '../../../db/repo/start';
import { logicalDate } from '../../../domain/dates';
import { AFFECT_DURATIONS, AFFECT_INTENSITIES, affectShownKey, shouldAskAffect } from '../../../domain/start/affect';
import type { AffectPredictionValue, ID } from '../../../domain/types';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { useFlags } from '../../hooks/useFlags';
import { useSettings } from '../../hooks/useSettings';
import { StartTaskContext } from '../../hooks/useStartTask';

export function StartTaskProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const { roughStart } = useFlags();
  const [asking, setAsking] = useState<ID | null>(null);

  const begin = useCallback(
    async (taskId: ID, affect: AffectPredictionValue | null) => {
      setAsking(null);
      const s = await startSession(taskId, roughStart, affect, Date.now());
      navigate(`/session/${s.id}`);
    },
    [navigate, roughStart],
  );

  const start = useCallback(
    async (taskId: ID) => {
      const now = Date.now();
      const today = logicalDate(now);
      const ctx = await queryAffectContext(taskId);
      const goalId = ctx.task?.goalId ?? null;
      const ask =
        ctx.task !== null &&
        shouldAskAffect({
          task: ctx.task,
          goal: ctx.goal,
          judged: ctx.judged,
          predictions: ctx.predictions,
          shownToday: goalId !== null && settings?.dismissed[affectShownKey(goalId)] === today,
          roughStart,
          today,
        });
      if (!ask || !goalId) return begin(taskId, null);
      // とばしても同じ日にもう一度出さないよう、出した日を残す
      await updateSettings({ dismissed: { ...(settings?.dismissed ?? {}), [affectShownKey(goalId)]: today } }, now);
      setAsking(taskId);
    },
    [begin, roughStart, settings],
  );

  const api = useMemo(() => ({ start }), [start]);
  return (
    <StartTaskContext.Provider value={api}>
      {children}
      <BottomSheet open={asking !== null} onClose={() => setAsking(null)} title={ja.start.affectQ} testId="affect-sheet">
        {asking && <AffectForm onRecord={(a) => void begin(asking, a)} onSkip={() => void begin(asking, null)} />}
      </BottomSheet>
    </StartTaskContext.Provider>
  );
}

export function AffectInputs({
  intensity,
  duration,
  onIntensity,
  onDuration,
  intensityLabel = ja.start.affectQ,
  durationLabel = ja.start.affectDurQ,
}: {
  intensity: number | null;
  duration: number | null;
  onIntensity: (v: number) => void;
  onDuration: (v: number) => void;
  intensityLabel?: string;
  durationLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ChipGroup label={intensityLabel} className="gap-1">
        {AFFECT_INTENSITIES.map((v) => (
          <ChoiceChip key={v} selected={intensity === v} onToggle={() => onIntensity(v)}>
            {v}
          </ChoiceChip>
        ))}
      </ChipGroup>
      <div className="flex justify-between text-caption text-text-2">
        <span>{ja.start.affectLow}</span>
        <span>{ja.start.affectHigh}</span>
      </div>
      <span className="text-label">{durationLabel}</span>
      <ChipGroup label={durationLabel}>
        {AFFECT_DURATIONS.map((m) => (
          <ChoiceChip key={m} selected={duration === m} onToggle={() => onDuration(m)}>
            {m === 60 ? ja.start.affectMore : fill(ja.start.affectMinutes, { n: m })}
          </ChoiceChip>
        ))}
      </ChipGroup>
    </div>
  );
}

function AffectForm({ onRecord, onSkip }: { onRecord: (a: AffectPredictionValue) => void; onSkip: () => void }) {
  const [intensity, setIntensity] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-4 pb-2">
      <AffectInputs intensity={intensity} duration={duration} onIntensity={setIntensity} onDuration={setDuration} />
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="lg"
          disabled={intensity === null || duration === null}
          onClick={() => intensity !== null && duration !== null && onRecord({ intensity, durationMin: duration })}
        >
          {ja.start.affectRecordStart}
        </Button>
        <Button size="lg" variant="secondary" onClick={onSkip}>
          {ja.start.affectSkipStart}
        </Button>
      </div>
    </div>
  );
}
