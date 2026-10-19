// 傾向と対策（§6.10）。全 active 習慣の今週・先週の {done}/{scheduled}、習慣ごとの傾向と登録した対策
import { useLiveQuery } from 'dexie-react-hooks';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryWeeklyData } from '../../../db/queries/review';
import { addDays, logicalDate, weekStartOf } from '../../../domain/dates';
import { detectPatterns } from '../../../domain/habits/patterns';
import { scheduledDates } from '../../../domain/habits/schedule';
import type { Habit, HabitLog, LocalDate } from '../../../domain/types';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNow } from '../../hooks/useNow';
import { Koma } from '../../mascot/Koma';
import { patternLine } from './WeeklyCards';

function weekRatio(h: Habit, logs: HabitLog[], ws: LocalDate) {
  const dates = scheduledDates(h, ws, addDays(ws, 6));
  const done = new Set(logs.filter((l) => l.habitId === h.id && l.done).map((l) => l.date));
  return { done: dates.filter((d) => done.has(d)).length, scheduled: dates.length };
}

export default function Patterns() {
  const today = logicalDate(useNow());
  const data = useLiveQuery(() => queryWeeklyData(), []);
  if (!data) return null;
  const habits = data.habits.filter((h) => h.status === 'active').sort((a, b) => a.createdAt - b.createdAt);
  const ws = weekStartOf(today);
  const results = habits.map((h) => ({ h, patterns: detectPatterns(h, data.habitLogs, today) }));
  const anyPattern = results.some((r) => r.patterns.length > 0);

  return (
    <main className="flex flex-col gap-3 px-4 pb-8" data-testid="patterns">
      <ScreenHeader title={ja.review.patterns} fallback="/review" />
      {habits.map((h) => (
        <Card key={h.id} data-testid={`patterns-${h.id}`}>
          <h2 className="text-h2">{h.name}</h2>
          <p className="text-caption text-text-2">
            {fill(ja.review.patternsScreen.thisWeek, weekRatio(h, data.habitLogs, ws))}
            {ja.common.separator}
            {fill(ja.review.patternsScreen.lastWeek, weekRatio(h, data.habitLogs, addDays(ws, -7)))}
          </p>
          {results
            .find((r) => r.h.id === h.id)
            ?.patterns.map((p) => {
              const cm = data.countermeasures.find((c) => c.habitId === h.id && c.conditionKey === p.key);
              return (
                <div key={p.key} className="mt-2">
                  <p className="text-body">{patternLine(p)}</p>
                  {cm && (
                    <p className="text-caption text-text-2">
                      {ja.review.counter}: {cm.action}
                    </p>
                  )}
                </div>
              );
            })}
        </Card>
      ))}
      {!anyPattern && (
        <div className="flex flex-col items-center py-4">
          <Koma pose="sit" says={ja.koma.noPattern} />
        </div>
      )}
    </main>
  );
}
