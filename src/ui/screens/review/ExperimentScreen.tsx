// 実験（§9.5）。判定の表示は事実だけ。褒める・慰める文言は出さない
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { copyByKey, fill } from '../../../copy/fill';
import { queryExperiments } from '../../../db/queries/experiment';
import { queryGoalsData } from '../../../db/queries/goals';
import { queryWeeklyData } from '../../../db/queries/review';
import { startExperiment, stopExperiment } from '../../../db/repo/common';
import { addDays, logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { isDomainError } from '../../../domain/errors';
import { nextMonday, phaseFor, PRESET_SCHEDULE, runningExperiment, weekOf } from '../../../domain/experiment';
import type { Experiment, ExperimentPreset } from '../../../domain/types';
import { evaluateExperiment, type VerifyData } from '../../../domain/verify/hypotheses';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CheckSheet } from '../../components/CheckSheet';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNow } from '../../hooks/useNow';

const PRESETS: ExperimentPreset[] = ['start', 'board', 'kizami'];

export default function ExperimentScreen() {
  const now = useNow();
  const today = logicalDate(now);
  const experiments = useLiveQuery(() => queryExperiments(), []);
  const weekly = useLiveQuery(() => queryWeeklyData(), []);
  const goals = useLiveQuery(() => queryGoalsData(), []);
  if (!experiments || !weekly || !goals) return null;
  const data: VerifyData = {
    tasks: weekly.tasks,
    sessions: weekly.sessions,
    stuckLogs: weekly.stuckLogs,
    escapeLogs: weekly.escapeLogs,
    dailyChecks: weekly.dailyChecks,
    moves: weekly.moves,
    moveReviews: weekly.moveReviews,
    runs: weekly.runs,
    goals: goals.goals,
    metrics: goals.metrics,
    predictions: goals.predictions,
    judgments: goals.judgments,
    corrections: goals.corrections,
    followUps: goals.followUps,
    appOpens: weekly.appOpens,
  };
  const running = runningExperiment(experiments, today);
  const finished = experiments.filter((e) => e.id !== running?.id).reverse();

  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="experiment">
      <ScreenHeader title={ja.experiment.title} fallback="/review" />
      {running ? <Running e={running} data={data} today={today} now={now} /> : <Choose today={today} />}
      {finished.length > 0 && (
        <section aria-label={ja.experiment.past} className="flex flex-col gap-2">
          <h2 className="text-h2">{ja.experiment.past}</h2>
          {finished.map((e) => (
            <Card key={e.id}>
              <p className="text-body">{ja.experiment.presets[e.preset].name}</p>
              <p className="text-caption text-text-2">
                {fill(ja.experiment.period, { start: formatDateShort(e.startDate), end: formatDateShort(addDays(e.startDate, PRESET_SCHEDULE[e.preset].length * 7 - 1)) })}
                {e.stoppedAt !== null && ` ${ja.experiment.stopped}`}
              </p>
              <Results e={e} data={data} today={today} now={now} />
            </Card>
          ))}
        </section>
      )}
      <p className="text-caption text-text-2">{ja.experiment.limits}</p>
    </main>
  );
}

function Results({ e, data, today, now }: { e: Experiment; data: VerifyData; today: string; now: number }) {
  return (
    <ul className="mt-2 flex flex-col gap-1" data-testid={`results-${e.id}`}>
      {evaluateExperiment(e, data, today, now).map((r) => (
        <li key={r.id} className="text-body">
          {fill(r.detail ? ja.experiment.result : ja.experiment.resultRunning, {
            id: ja.experiment.ids[r.id as keyof typeof ja.experiment.ids],
            status: ja.experiment.status[r.status],
            detail: r.detail,
          })}
        </li>
      ))}
    </ul>
  );
}

function Running({ e, data, today, now }: { e: Experiment; data: VerifyData; today: string; now: number }) {
  const [stopping, setStopping] = useState(false);
  const phase = phaseFor(e.preset, e.startDate, today);
  const w = weekOf(e.startDate, today);
  const schedule = PRESET_SCHEDULE[e.preset];
  return (
    <Card className="flex flex-col gap-3" data-testid="experiment-running">
      <p className="text-caption text-text-2">{ja.experiment.status.running}</p>
      <h2 className="text-h2">{ja.experiment.presets[e.preset].name}</h2>
      <ol className="flex gap-1" aria-label={ja.experiment.current}>
        {schedule.map((p, k) => (
          <li
            key={k}
            aria-current={k === w ? 'step' : undefined}
            className={`flex h-10 min-w-8 flex-1 flex-col items-center justify-center rounded-lg text-caption ${k === w ? 'border-2 border-primary' : 'border border-border'} ${p === 'A' ? 'bg-surface-2' : 'bg-surface'}`}
          >
            <span>{p}</span>
          </li>
        ))}
      </ol>
      <p className="text-body" data-testid="experiment-now">
        {phase === 'notStarted'
          ? fill(ja.experiment.notStarted, { date: formatDateShort(e.startDate) })
          : phase === 'A'
            ? ja.experiment.presets[e.preset].nowA
            : ja.experiment.nowB}
      </p>
      <Results e={e} data={data} today={today} now={now} />
      <Button variant="secondary" onClick={() => setStopping(true)}>
        {ja.experiment.stop}
      </Button>
      <CheckSheet
        open={stopping}
        title={ja.experiment.stopTitle}
        confirmLabel={ja.experiment.stop}
        onFix={() => setStopping(false)}
        onConfirm={async () => {
          await stopExperiment(e.id, Date.now());
          setStopping(false);
        }}
      />
    </Card>
  );
}

function Choose({ today }: { today: string }) {
  const [startDate, setStartDate] = useState(nextMonday(today));
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-label">{ja.experiment.startDate}</span>
        <input
          type="date"
          value={startDate}
          min={today}
          onChange={(ev) => ev.target.value && setStartDate(ev.target.value)}
          data-testid="experiment-start-date"
          className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-3 text-body"
        />
      </label>
      <ChipGroup label={ja.experiment.startDate}>
        <ChoiceChip selected={startDate === nextMonday(today)} onToggle={() => setStartDate(nextMonday(today))}>
          {formatDateShort(nextMonday(today))}
        </ChoiceChip>
      </ChipGroup>
      {error && (
        <p role="alert" className="text-body">
          {error}
        </p>
      )}
      {PRESETS.map((p) => (
        <Card key={p} className="flex flex-col gap-2" data-testid={`preset-${p}`}>
          <h2 className="text-h2">{ja.experiment.presets[p].name}</h2>
          <p className="text-caption text-text-2">{fill(ja.experiment.weeks, { n: PRESET_SCHEDULE[p].length })}</p>
          <p className="text-body">{ja.experiment.presets[p].changes}</p>
          <p className="text-caption text-text-2">{ja.experiment.presets[p].hypothesis}</p>
          <Button
            onClick={async () => {
              setError(null);
              try {
                await startExperiment(p, startDate, Date.now());
              } catch (e) {
                setError(copyByKey(isDomainError(e) ? e.copyKey : 'errors.unknown'));
              }
            }}
          >
            {ja.experiment.begin}
          </Button>
        </Card>
      ))}
    </div>
  );
}
