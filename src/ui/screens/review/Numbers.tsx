// 数字（週次レポート、§6.10）。数値だけを表で出し、評価語は使わない。データが足りない指標は「—（{n}件）」
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryWeeklyData } from '../../../db/queries/review';
import { BLIND_SPOTS, blindSpotStats } from '../../../domain/board/moves';
import { addDays, inRange, logicalDate, weekStartOf } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { reviewTargetWeek } from '../../../domain/review/weekly';
import type { LocalDate } from '../../../domain/types';
import {
  badRate,
  driftByWorry,
  escapeBreakdown,
  escapeRecordRate,
  medianDelayHours,
  noStuckContinueRate,
  startRate,
  stuckContinueRate,
  type Ratio,
} from '../../../domain/verify/metrics';
import { NUMBERS_MIN_N } from '../../../domain/verify/thresholds';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNow } from '../../hooks/useNow';

const insufficient = (n: number) => fill(ja.common.insufficient, { n });
const round1 = (v: number) => Math.round(v * 10) / 10;

export function formatRatio(r: Ratio): string {
  if (r.value === null || r.d < NUMBERS_MIN_N) return insufficient(r.d);
  return fill(ja.review.numbersScreen.ratioValue, { pct: Math.round(r.value * 100), n: r.n, d: r.d });
}

const PRIOR_LABEL = { anxiety: ja.start.anxiety, fatigue: ja.start.fatigue, ambiguity: ja.start.ambiguity, boredom: ja.start.boredom } as const;
const BLIND_LABEL = { board: ja.review.board, eval: ja.review.eval, trigger: ja.review.trigger, reading: ja.review.reading } as const;

export default function Numbers() {
  const today = logicalDate(useNow());
  const data = useLiveQuery(() => queryWeeklyData(), []);
  const [weekStart, setWeekStart] = useState<LocalDate>(() => reviewTargetWeek(today) ?? weekStartOf(today));
  if (!data) return null;
  const end = addDays(weekStart, 6);
  const inWeek = (ms: number) => inRange(logicalDate(ms), weekStart, end);
  const sessions = data.sessions.filter((s) => inWeek(s.startedAt));
  const stucks = data.stuckLogs.filter((s) => inWeek(s.at));
  const escapes = data.escapeLogs.filter((e) => inWeek(e.at));
  const breakdown = escapeBreakdown(escapes);
  const drift = driftByWorry(data.dailyChecks.filter((c) => inRange(c.date, weekStart, end)));
  const stats = blindSpotStats(data.moves, data.moveReviews, weekStart, end);
  const judgments = data.judgments.filter((j) => inWeek(j.judgedAt));
  const delay = medianDelayHours(judgments);

  const median = (v: number | null, n: number) => (v === null || n < NUMBERS_MIN_N ? insufficient(n) : fill(ja.review.numbersScreen.minutes, { v: round1(v), n }));
  const rows: [string, string][] = [
    [ja.review.numbersScreen.startRate, formatRatio(startRate(data.tasks, data.sessions, weekStart, end))],
    [ja.review.numbersScreen.stuckContinue, formatRatio(stuckContinueRate(stucks, data.sessions))],
    [ja.review.numbersScreen.noStuckContinue, formatRatio(noStuckContinueRate(stucks, sessions))],
    [ja.review.numbersScreen.escapeRecord, formatRatio(escapeRecordRate(sessions, data.escapeLogs))],
    [ja.review.numbersScreen.driftWorry, median(drift.worry.median, drift.worry.n)],
    [ja.review.numbersScreen.driftNoWorry, median(drift.noWorry.median, drift.noWorry.n)],
    [ja.review.numbersScreen.badRate, formatRatio(badRate(data.moves, data.moveReviews, weekStart, end))],
    [
      ja.review.numbersScreen.delay,
      delay === null || judgments.length < 1 ? insufficient(judgments.length) : fill(ja.review.numbersScreen.hours, { v: round1(delay), n: judgments.length }),
    ],
  ];

  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="numbers">
      <ScreenHeader title={ja.review.numbersScreen.title} fallback="/review" />
      <div className="flex items-center justify-between">
        <button type="button" aria-label={ja.review.numbersScreen.prev} className="flex size-12 items-center justify-center" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft size={20} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <p className="text-label" data-testid="numbers-week">
          {fill(ja.review.weekOf, { date: formatDateShort(weekStart) })}
        </p>
        <button type="button" aria-label={ja.review.numbersScreen.next} className="flex size-12 items-center justify-center" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
      <table className="card w-full border-separate border-spacing-0 p-0 text-body">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row" className="border-b border-border px-3 py-2 text-left font-medium">
                {label}
              </th>
              <td className="border-b border-border px-3 py-2 text-right tabular-nums" data-testid={`metric-${label}`}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <section aria-label={ja.review.numbersScreen.escapes}>
        <h2 className="mb-2 text-h2">{ja.review.numbersScreen.escapes}</h2>
        <table className="card w-full p-0 text-body">
          <tbody>
            {(['anxiety', 'fatigue', 'ambiguity', 'boredom', 'none'] as const).map((k) => (
              <tr key={k}>
                <th scope="row" className="px-3 py-1 text-left font-medium">
                  {k === 'none' ? ja.review.numbersScreen.none : PRIOR_LABEL[k]}
                </th>
                <td className="px-3 py-1 text-right">{fill(ja.review.numbersScreen.count, { n: breakdown.priorState[k] })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-label={ja.review.numbersScreen.blind}>
        <h2 className="mb-2 text-h2">{ja.review.numbersScreen.blind}</h2>
        <table className="card w-full p-0 text-body">
          <tbody>
            {BLIND_SPOTS.map((b) => (
              <tr key={b}>
                <th scope="row" className="px-3 py-1 text-left font-medium">
                  {BLIND_LABEL[b]}
                </th>
                <td className="px-3 py-1 text-right">{fill(ja.review.numbersScreen.count, { n: stats.byBlindSpot[b] })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
