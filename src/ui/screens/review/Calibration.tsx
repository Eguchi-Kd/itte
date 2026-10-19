// 較正（§6.8.7）。助言や評価の言葉は表示しない。予想のない判定は除外する
import { useLiveQuery } from 'dexie-react-hooks';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryGoalsData } from '../../../db/queries/goals';
import {
  affectErrors,
  calibrationError,
  calibrationSeries,
  medianDelayHours,
  probabilityCalibration,
} from '../../../domain/goals/calibration';
import { Card } from '../../components/Card';
import { CalibrationChart, CalibrationScatter } from '../../components/CalibrationChart';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Koma } from '../../mascot/Koma';

const signed = (v: number, digits = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`;
const round1 = (v: number) => Math.round(v * 10) / 10;

export default function Calibration() {
  const data = useLiveQuery(() => queryGoalsData(), []);
  if (!data) return null;
  const series = calibrationSeries(data.judgments, data.goals, data.metrics, data.predictions, data.corrections);
  const e = calibrationError(series);
  const prob = probabilityCalibration(data.judgments, data.goals, data.predictions);
  const affect = affectErrors(data.predictions, data.affectActuals);
  const delay = medianDelayHours(data.judgments);
  const scatter = series.slice(-20).map((p) => {
    const t = Math.max(Math.abs(p.target), 1);
    return { x: p.predicted / t, y: p.actual / t };
  });
  const byMetric = new Map<string, number[]>();
  for (const p of series) byMetric.set(p.metricId, [...(byMetric.get(p.metricId) ?? []), p.raw]);

  return (
    <main className="flex flex-col gap-3 px-4 pb-8" data-testid="calibration">
      <ScreenHeader title={ja.goals.calib.title} fallback="/review" />
      {series.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <Koma pose="sit" says={ja.goals.calib.empty} />
        </div>
      ) : (
        <>
          <Card>
            <p className="text-caption text-text-2">{ja.goals.calib.main}</p>
            <p className="text-display" data-testid="calibration-error">
              {e === null ? ja.goals.calib.none : signed(e)}
            </p>
            <p className="text-caption text-text-2">{fill(ja.goals.calib.count, { n: series.length })}</p>
            <p className="mt-2 text-body">{ja.goals.calib.meaning}</p>
          </Card>
          <Card>
            <h2 className="mb-2 text-h2">{ja.goals.calib.chart}</h2>
            <CalibrationChart values={series.map((p) => p.norm)} label={ja.goals.calib.chart} />
          </Card>
          <Card>
            <h2 className="mb-2 text-h2">{ja.goals.calib.scatter}</h2>
            <CalibrationScatter points={scatter} label={ja.goals.calib.scatter} />
          </Card>
          <Card>
            <h2 className="mb-2 text-h2">{ja.goals.calib.raw}</h2>
            <ul>
              {[...byMetric].map(([metricId, raws]) => {
                const m = data.metrics.find((x) => x.id === metricId);
                const mean = raws.reduce((s, v) => s + v, 0) / raws.length;
                return (
                  <li key={metricId} className="text-body">
                    {fill(ja.goals.calib.rawRow, { metric: m?.name ?? '', value: signed(mean, 1), unit: m?.unit ?? '', n: raws.length })}
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
      <Card className="flex flex-col gap-2">
        {prob.n > 0 && (
          <p className="text-body" data-testid="calibration-prob">
            {fill(ja.goals.calib.prob, { p: round1(prob.meanProbability ?? 0), q: round1((prob.metRate ?? 0) * 100), n: prob.n })}
          </p>
        )}
        {affect.n > 0 && (
          <p className="text-body">
            {fill(ja.goals.calib.affect, { i: signed(affect.intensity ?? 0, 1), d: signed(affect.duration ?? 0, 1), n: affect.n })}
          </p>
        )}
        <p className="text-body" data-testid="calibration-delay">
          {fill(ja.goals.calib.delay, { h: delay === null ? ja.goals.calib.none : round1(delay) })}
        </p>
      </Card>
    </main>
  );
}
