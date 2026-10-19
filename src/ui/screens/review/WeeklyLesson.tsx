// 週次ふりかえり（§6.9）。1枚ごとに即保存し、途中で閉じても次は続きから始まる
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { queryGoalsData, type GoalsData } from '../../../db/queries/goals';
import { queryWeeklyData, type WeeklyData } from '../../../db/queries/review';
import { upsertWeeklyReviewRun } from '../../../db/repo/common';
import { logicalDate } from '../../../domain/dates';
import { buildWeeklyCards, type WeeklyCard, type WeeklyInput } from '../../../domain/review/weekly';
import type { ID, LocalDate, Settings } from '../../../domain/types';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useSettings } from '../../hooks/useSettings';
import { CloseCard, FactsCard, HabitCheckCard, MoveReviewCard, PatternCard, StallReviewCard, type CardFrame } from './WeeklyCards';

export default function WeeklyLesson() {
  const { weekStart = '' } = useParams();
  const data = useLiveQuery(() => queryWeeklyData(), []);
  const goalsData = useLiveQuery(() => queryGoalsData(), []);
  const settings = useSettings();
  if (!data || !goalsData || !settings || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
  return <Lesson key={weekStart} weekStart={weekStart} data={data} goalsData={goalsData} settings={settings} />;
}

function toInput(data: WeeklyData, settings: Settings): WeeklyInput {
  return {
    habits: data.habits,
    habitLogs: data.habitLogs,
    checks: data.checks,
    sessions: data.sessions,
    stuckLogs: data.stuckLogs,
    escapeLogs: data.escapeLogs,
    moves: data.moves,
    judgments: data.judgments,
    stallFlags: data.stallFlags,
    persona: settings.persona,
  };
}

function Lesson({ weekStart, data, goalsData, settings }: { weekStart: LocalDate; data: WeeklyData; goalsData: GoalsData; settings: Settings }) {
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const today = logicalDate(Date.now());
  // 開いた時点のカードの並びを固定する（途中で足踏みを却下しても番号がずれないように）
  const [cards] = useState<WeeklyCard[]>(() => buildWeeklyCards(toInput(data, settings), weekStart, today));
  const run = data.runs.find((r) => r.weekStart === weekStart);
  const [cursor, setCursor] = useState(() => (run && !run.completedAt ? Math.min(run.cursor, cards.length - 1) : 0));
  const [reduceIds, setReduceIds] = useState<ID[]>([]);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void upsertWeeklyReviewRun(weekStart, { cursor }, Date.now());
  }, [weekStart, cursor]);

  const close = () => navigate('/', { replace: true });
  const next = () => {
    const n = Math.min(cursor + 1, cards.length - 1);
    setCursor(n);
    void upsertWeeklyReviewRun(weekStart, { cursor: n }, Date.now());
  };
  const finish = async () => {
    setBusy(true);
    try {
      await upsertWeeklyReviewRun(weekStart, { cursor: cards.length - 1, completed: true }, Date.now());
      notify({ type: 'weeklyReview' });
      // 量を減らすを選んだ習慣があれば、完了後にその習慣の編集へ（§6.9）
      navigate(reduceIds[0] ? `/habits/${reduceIds[0]}/edit` : '/', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const card = cards[cursor];
  const frame: CardFrame = { step: cursor + 1, total: cards.length, onClose: close, onNext: next };
  switch (card.section) {
    case 'facts':
      return <FactsCard frame={frame} input={toInput(data, settings)} weekStart={weekStart} />;
    case 'moves':
      return <MoveReviewCard key={card.key} frame={frame} data={data} moveId={card.moveId} />;
    case 'habits':
      return (
        <HabitCheckCard
          key={card.key}
          frame={frame}
          data={data}
          habitId={card.habitId}
          weekStart={weekStart}
          reviewDue={card.reviewDue}
          graduationEligible={card.graduationEligible}
          onReduce={(id) => setReduceIds((l) => [...l, id])}
        />
      );
    case 'patterns':
      return <PatternCard key={card.key} frame={frame} data={data} habitId={card.habitId} patterns={card.patterns} />;
    case 'stalls':
      return <StallReviewCard key={card.key} frame={frame} goalsData={goalsData} settings={settings} flagId={card.flagId} />;
    case 'close':
      return <CloseCard frame={frame} data={data} weekStart={weekStart} today={today} busy={busy} onFinish={() => void finish()} />;
  }
}
