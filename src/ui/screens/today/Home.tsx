// きょう（ホーム、§6.3）
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { queryHomeData } from '../../../db/queries/habits';
import { updateSettings } from '../../../db/repo/common';
import { carryOverTask, closeTask } from '../../../db/repo/start';
import { logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { buildTodayPath, unscheduledHabits } from '../../../domain/path';
import type { Habit, LocalDate } from '../../../domain/types';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { EntryChoices, ENTRY_PATHS } from '../../components/EntryChoices';
import { useFlags } from '../../hooks/useFlags';
import { useHabitActions } from '../../hooks/useHabitActions';
import { useNow } from '../../hooks/useNow';
import { useSettings } from '../../hooks/useSettings';
import { useStartTask } from '../../hooks/useStartTask';
import { ListRow } from '../../components/ListRow';
import { fill } from '../../../copy/fill';
import { CarryCard } from './CarryCard';
import { ResumeCard } from './ResumeCard';
import { TaskNodeView } from './TaskNodeView';
import { DailyNodeView } from './DailyNodeView';
import { DecideNodeView } from './DecideNodeView';
import { BoardStrip } from './BoardStrip';
import { AmountSheet } from './AmountSheet';
import { HabitNodeView } from './HabitNodeView';
import { PastRecordsSheet } from './PastRecordsSheet';
import { ReasonCard } from './ReasonCard';

export default function Home() {
  const navigate = useNavigate();
  const now = useNow();
  const settings = useSettings();
  const today: LocalDate = logicalDate(now);
  const data = useLiveQuery(() => queryHomeData(today), [today]);
  const actions = useHabitActions();
  const flags = useFlags();
  const startTask = useStartTask();
  const [amountFor, setAmountFor] = useState<Habit | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);

  if (!data || !settings) return null;

  const path = buildTodayPath(
    {
      today,
      persona: settings.persona,
      flags,
      habits: data.habits,
      habitLogs: data.logs,
      tasks: data.tasks,
      sessions: data.sessions,
      moves: data.moves,
      candidates: data.candidates,
      startUsed: data.startUsed,
      dailyDone: data.dailyDone,
      dismissed: settings.dismissed,
    },
    now,
  );
  const habitById = new Map(data.habits.map((h) => [h.id, h]));
  const unscheduled = unscheduledHabits(data.habits, today);
  const empty = !data.hasRecords && path.interrupts.length === 0;
  const dismiss = (id: string) => void updateSettings({ dismissed: { ...settings.dismissed, [id]: today } }, Date.now());

  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-6" data-testid="home">
      <header className="flex items-center justify-between">
        <p className="text-h2" data-testid="home-date">
          {formatDateShort(today)}
        </p>
        <Link
          to="/settings"
          aria-label={ja.common.settings}
          className="flex size-12 items-center justify-center rounded-2xl text-text-2"
        >
          <SettingsIcon size={24} strokeWidth={2.25} aria-hidden="true" />
        </Link>
      </header>

      <BoardStrip today={today} />

      {path.interrupts.map((card) =>
        card.id === 'resume' ? (
          <ResumeCard key={card.id} sessionId={card.sessionId} startedAt={card.startedAt} />
        ) : card.id === 'reason' ? (
          <ReasonCard
            key={card.id}
            prompts={card.prompts}
            habits={data.habits}
            tags={data.tags}
            onTag={(p, tagIds) => void actions.missed(p.habitId, p.date, tagIds)}
            onLater={() => dismiss('reason')}
          />
        ) : (
          <CarryCard
            key={card.id}
            tasks={card.tasks}
            onMove={(task) => void carryOverTask(task.id, today, Date.now())}
            onClose={(task, reason) => void closeTask(task.id, reason, Date.now())}
            onLater={() => dismiss('carry')}
          />
        ),
      )}

      {empty ? (
        <EmptyState text={ja.koma.emptyHome} actionLabel={ja.today.createFirst} onAction={() => setEntryOpen(true)} />
      ) : (
        <section aria-label={ja.today.path}>
          <ol className="flex flex-col" data-testid="today-path">
            {path.nodes.map((node, i) => {
              if (node.kind === 'daily') {
                return (
                  <DailyNodeView
                    key={node.id}
                    state={node.state}
                    isLast={i === path.nodes.length - 1}
                    onAnswer={() => navigate('/daily')}
                  />
                );
              }
              if (node.kind === 'decide') {
                return <DecideNodeView key={node.id} node={node} isLast={i === path.nodes.length - 1} />;
              }
              if (node.kind === 'task') {
                return (
                  <TaskNodeView
                    key={node.id}
                    node={node}
                    isLast={i === path.nodes.length - 1}
                    onStart={() => void startTask(node.taskId)}
                  />
                );
              }
              const habit = habitById.get(node.habitId);
              return (
                <HabitNodeView
                  key={node.id}
                  node={node}
                  isLast={i === path.nodes.length - 1}
                  onDone={() => void actions.done(node.habitId, today)}
                  onAmount={() => setAmountFor(habit ?? null)}
                  onUndo={() => void actions.undo(node.habitId, today)}
                  onAddMore={() => void actions.done(node.habitId, today)}
                />
              );
            })}
          </ol>
          {path.nextNodeId === null && (
            <p className="mt-3 text-center text-body text-text-2" data-testid="all-done">
              {ja.today.allDone}
            </p>
          )}
        </section>
      )}

      {path.otherTasks.length > 0 && (
        <details className="card p-0" data-testid="other-tasks">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-label">
            {fill(ja.today.otherTasks, { n: path.otherTasks.length })}
            <ChevronDown size={20} strokeWidth={2.25} aria-hidden="true" />
          </summary>
          <div className="pb-1">
            {path.otherTasks.map((t) => (
              <ListRow key={t.id} to={`/tasks/${t.id}`} title={t.nextStep ?? t.title} />
            ))}
          </div>
        </details>
      )}

      {unscheduled.length > 0 && (
        <details className="card p-0" data-testid="unscheduled">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-label">
            {ja.today.unscheduledHabits}
            <ChevronDown size={20} strokeWidth={2.25} aria-hidden="true" />
          </summary>
          <ul className="flex flex-col gap-2 px-4 pb-3">
            {unscheduled.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2">
                <span className="text-body">{h.name}</span>
                <Button size="md" variant="secondary" onClick={() => void actions.done(h.id, today)}>
                  {ja.today.node.done}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!empty && (
        <button
          type="button"
          className="mx-auto min-h-12 px-4 text-caption text-text-2 underline"
          onClick={() => setPastOpen(true)}
        >
          {ja.today.fixPast}
        </button>
      )}

      <AmountSheet
        habit={amountFor}
        onClose={() => setAmountFor(null)}
        onRecord={(amount) => {
          if (amountFor) void actions.done(amountFor.id, today, amount);
          setAmountFor(null);
        }}
      />
      <PastRecordsSheet
        open={pastOpen}
        onClose={() => setPastOpen(false)}
        today={today}
        habits={data.habits}
        logs={data.logs}
        tags={data.tags}
        onDone={(id, date) => void actions.done(id, date)}
        onMissed={(id, date, tags) => void actions.missed(id, date, tags)}
        onUndo={(id, date) => void actions.undo(id, date)}
      />
      <BottomSheet open={entryOpen} onClose={() => setEntryOpen(false)} title={ja.onboarding.entryTitle}>
        <div className="pb-2">
          <EntryChoices
            onChoose={(t) => {
              setEntryOpen(false);
              navigate(ENTRY_PATHS[t]);
            }}
          />
        </div>
      </BottomSheet>
    </main>
  );
}
