// 習慣の詳細（§6.5.3）。累積量と「28日間で {done}/{scheduled} 回」を主に出す。連続日数は出さない（D2）
import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryHabitDetail } from '../../../db/queries/habits';
import { updateSettings } from '../../../db/repo/common';
import { saveHabit, setHabitStatus } from '../../../db/repo/habits';
import { logicalDate } from '../../../domain/dates';
import { formatAmount } from '../../../domain/display';
import { automaticityScore, graduationEligible } from '../../../domain/habits/automaticity';
import { formatIntention } from '../../../domain/habits/formatIntention';
import { levelUpSuggestion } from '../../../domain/habits/guards';
import { reasonBreakdown } from '../../../domain/habits/patterns';
import { isScheduled } from '../../../domain/habits/schedule';
import { cumulativeAmount, recentRatio, weeklySeries } from '../../../domain/habits/stats';
import { exportHabitIcs } from '../../../domain/ics';
import type { HabitStatus } from '../../../domain/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { MonthCalendar } from '../../components/MonthCalendar';
import { ScreenHeader } from '../../components/ScreenHeader';
import { downloadText } from '../../download';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useNow } from '../../hooks/useNow';
import { useSettings } from '../../hooks/useSettings';

const WeeklyBarChart = lazy(() => import('../../components/WeeklyBarChart'));

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <Card data-testid={testId}>
      <h2 className="mb-2 text-h2">{title}</h2>
      {children}
    </Card>
  );
}

export default function HabitDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const today = logicalDate(now);
  const settings = useSettings();
  const { notify } = useFeedback();
  const data = useLiveQuery(() => queryHabitDetail(id), [id]);

  if (!data || !settings) return null;
  const { habit, logs, checks, countermeasures, tags } = data;
  if (!habit) {
    return (
      <main className="flex flex-col gap-4 px-4">
        <ScreenHeader title={ja.habits.list.title} fallback="/library/habits" />
        <p className="text-body">{ja.habits.detail.notFound}</p>
      </main>
    );
  }

  const total = cumulativeAmount(habit, logs);
  const r28 = recentRatio(habit, logs, today, 28);
  const series = weeklySeries(habit, logs, today, 12);
  const doneDates = new Set(logs.filter((l) => l.done).map((l) => l.date));
  const levelKey = `levelUp:${habit.id}`;
  const levelUp = habit.status === 'active' && settings.dismissed[levelKey] !== today ? levelUpSuggestion(habit, logs, today) : null;
  const canGraduate = habit.status === 'active' && graduationEligible(habit, logs, checks, today);
  const breakdown = reasonBreakdown(habit, logs, today);
  const tagLabel = new Map(tags.map((t) => [t.id, t.label]));
  const autoScores = [...checks].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)).map((c) => automaticityScore(c));
  const ics = exportHabitIcs(habit);

  const setStatus = async (status: HabitStatus) => {
    await setHabitStatus(habit.id, status, null, Date.now());
    notify({ type: 'saved' });
  };

  return (
    <main className="flex flex-col gap-3 px-4 pb-8" data-testid="habit-detail">
      <ScreenHeader
        title={habit.name}
        fallback="/library/habits"
        right={
          <Button size="sm" variant="secondary" onClick={() => navigate(`/habits/${habit.id}/edit`)}>
            {ja.common.edit}
          </Button>
        }
      />
      <section className="flex flex-col gap-1">
        <h2 className="text-h2" data-testid="intention">
          {formatIntention(habit)}
        </h2>
        {habit.purpose && (
          <p className="text-body text-text-2">
            {ja.habits.detail.purpose}: {habit.purpose}
          </p>
        )}
        {habit.status !== 'active' && (
          <p className="text-caption text-text-2">
            {ja.habits.detail.status}: {ja.habits.status[habit.status]}
          </p>
        )}
      </section>

      <Card>
        <p className="text-display" data-testid="total">
          {fill(ja.habits.total, { amount: formatAmount(total, habit.unit) })}
        </p>
        <p className="mt-1 text-body" data-testid="ratio28">
          {fill(ja.habits.ratio28, { done: r28.done, scheduled: r28.scheduled })}
        </p>
      </Card>

      {levelUp !== null && (
        <Card data-testid="level-up">
          <p className="text-body">{fill(ja.habits.levelUp, { n: levelUp, unit: habit.unit })}</p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={async () => {
                await saveHabit({ ...habit, amount: levelUp, minAmount: Math.min(habit.minAmount, levelUp) }, Date.now());
                notify({ type: 'saved' });
              }}
            >
              {ja.habits.levelUpAccept}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void updateSettings({ dismissed: { ...settings.dismissed, [levelKey]: today } }, Date.now())}
            >
              {ja.habits.levelUpDecline}
            </Button>
          </div>
        </Card>
      )}

      <Section title={ja.habits.detail.weekly}>
        <Suspense fallback={<div className="h-48" />}>
          <WeeklyBarChart data={series} label={ja.habits.detail.weeklyLegend} />
        </Suspense>
        <p className="text-caption text-text-2">{ja.habits.detail.weeklyLegend}</p>
      </Section>

      <Section title={ja.habits.detail.calendar}>
        <MonthCalendar today={today} isScheduled={(d) => isScheduled(habit, d)} doneDates={doneDates} />
      </Section>

      {autoScores.length > 0 && (
        <Section title={ja.habits.detail.automaticity}>
          <ol className="flex flex-wrap gap-2 text-caption">
            {autoScores.map((s, i) => (
              <li key={i} className="rounded-xl bg-surface-2 px-2 py-1">
                {s.toFixed(1)}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {breakdown.length > 0 && (
        <Section title={ja.habits.detail.reasons} testId="reasons">
          <ul className="flex flex-col gap-1">
            {breakdown.map((b) => (
              <li key={b.tagId} className="flex justify-between text-body">
                <span>{tagLabel.get(b.tagId) ?? b.tagId}</span>
                <span>{fill(ja.habits.detail.reasonCount, { n: b.count })}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {countermeasures.length > 0 && (
        <Section title={ja.habits.detail.countermeasures}>
          <ul className="flex flex-col gap-1">
            {countermeasures.map((c) => (
              <li key={c.id} className="text-body">
                {c.conditionLabel}: {c.action}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {canGraduate && (
        <Card data-testid="graduate">
          <p className="text-body">{ja.habits.graduate}</p>
          <Button className="mt-3" onClick={() => void setStatus('graduated')}>
            {ja.habits.graduateAction}
          </Button>
        </Card>
      )}

      {settings.persona === 'notfun' && habit.funNote && (
        <Section title={ja.habits.detail.funNote}>
          <p className="text-body">{habit.funNote}</p>
        </Section>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {habit.status === 'active' ? (
          <>
            <Button variant="secondary" onClick={() => void setStatus('graduated')}>
              {ja.habits.graduateAction}
            </Button>
            <Button variant="secondary" onClick={() => void setStatus('ended')}>
              {ja.habits.end}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => void setStatus('active')}>
            {ja.habits.resume}
          </Button>
        )}
        {ics && (
          <Button variant="secondary" onClick={() => downloadText(ja.habits.ics.fileName, ics, 'text/calendar')}>
            {ja.habits.exportIcs}
          </Button>
        )}
      </div>
    </main>
  );
}
