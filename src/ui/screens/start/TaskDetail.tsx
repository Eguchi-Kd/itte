// やることの詳細（§6.6.2）
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryTaskDetail } from '../../../db/queries/start';
import { carryOverTask, closeTask, updateTask } from '../../../db/repo/start';
import { logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { spentMinutes } from '../../../domain/start/session';
import type { Task } from '../../../domain/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useNow } from '../../hooks/useNow';
import { useStartTask } from '../../hooks/useStartTask';

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TaskDetail() {
  const { id = '' } = useParams();
  const now = useNow();
  const data = useLiveQuery(() => queryTaskDetail(id), [id]);
  const startTask = useStartTask();
  const { notify } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);

  if (!data) return null;
  const { task, sessions, stuckLogs, goal, boardItem } = data;
  if (!task) {
    return (
      <main className="flex flex-col gap-4 px-4">
        <ScreenHeader title={ja.start.list.title} fallback="/library/tasks" />
        <p className="text-body">{ja.start.detail.notFound}</p>
      </main>
    );
  }
  const today = logicalDate(now);
  const closed = task.archivedAt !== null;

  const rows: [string, string | null][] = [
    [ja.start.field.rough, task.roughVersion],
    [ja.start.field.first, task.firstAction],
    [ja.start.field.next, task.nextStep],
    [ja.start.field.planned, formatDateShort(task.plannedFor)],
    [ja.start.field.goal, goal?.title ?? null],
    [ja.start.field.boardItem, boardItem?.title ?? null],
  ];

  return (
    <main className="flex flex-col gap-3 px-4 pb-8" data-testid="task-detail">
      <ScreenHeader
        title={task.title}
        fallback="/library/tasks"
        right={
          !closed && (
            <Button size="sm" variant="secondary" onClick={() => setEditing((e) => !e)}>
              {ja.start.detail.edit}
            </Button>
          )
        }
      />
      {editing ? (
        <EditTask task={task} onDone={() => setEditing(false)} />
      ) : (
        <Card>
          <dl className="flex flex-col gap-2">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-caption text-text-2">{k}</dt>
                  <dd className="text-body">{v}</dd>
                </div>
              ))}
          </dl>
          {closed && task.closedReason && (
            <p className="mt-2 text-caption text-text-2">
              {fill(ja.start.detail.closed, { reason: task.closedReason === 'done' ? ja.start.closeDone : ja.start.closeDrop })}
            </p>
          )}
        </Card>
      )}

      {!closed && (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="accent" onClick={() => void startTask(task.id)}>
            {ja.today.node.start}
          </Button>
          {task.plannedFor < today && (
            <Button size="lg" variant="secondary" onClick={() => void carryOverTask(task.id, today, Date.now())}>
              {ja.start.detail.moveToday}
            </Button>
          )}
          <Button size="lg" variant="secondary" onClick={() => setClosing((c) => !c)}>
            {ja.start.close}
          </Button>
        </div>
      )}
      {closing && !closed && (
        <ChipGroup label={ja.start.detail.closeQ}>
          {(['done', 'dropped'] as const).map((r) => (
            <ChoiceChip
              key={r}
              selected={false}
              onToggle={async () => {
                await closeTask(task.id, r, Date.now());
                notify({ type: 'saved' });
                setClosing(false);
              }}
            >
              {r === 'done' ? ja.start.closeDone : ja.start.closeDrop}
            </ChoiceChip>
          ))}
        </ChipGroup>
      )}

      <Card>
        <h2 className="mb-2 text-h2">{ja.start.detail.sessions}</h2>
        {sessions.length === 0 ? (
          <p className="text-caption text-text-2">{ja.start.detail.noSessions}</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="session-history">
            {sessions.map((s) => (
              <li key={s.id} className="text-body">
                {fill(ja.start.detail.sessionRow, {
                  date: formatDateShort(logicalDate(s.startedAt)),
                  time: hhmm(s.startedAt),
                  n: spentMinutes(s, now),
                  outcome: ja.start.outcome[s.outcome ?? 'running'],
                })}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {stuckLogs.length > 0 && (
        <Card>
          <h2 className="mb-2 text-h2">{ja.start.detail.stucks}</h2>
          <ul className="flex flex-col gap-1">
            {stuckLogs.map((l) => (
              <li key={l.id} className="text-body">
                {fill(ja.start.detail.stuckRow, {
                  date: formatDateShort(logicalDate(l.at)),
                  blocker: l.blocker,
                  choice: l.choice === 'fill' ? ja.start.fill : l.choice === 'research5' ? ja.start.research5 : ja.start.stopWithNext,
                })}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}

function EditTask({ task, onDone }: { task: Task; onDone: () => void }) {
  const { notify } = useFeedback();
  const [title, setTitle] = useState(task.title);
  const [rough, setRough] = useState(task.roughVersion ?? '');
  const [first, setFirst] = useState(task.firstAction ?? '');
  const [next, setNext] = useState(task.nextStep ?? '');
  const valid = title.trim().length > 0;
  return (
    <Card className="flex flex-col gap-4">
      <TextField label={ja.start.field.title} value={title} onChange={setTitle} maxLength={80} />
      <TextField label={ja.start.field.rough} value={rough} onChange={setRough} maxLength={80} />
      <TextField label={ja.start.field.first} value={first} onChange={setFirst} maxLength={80} />
      <TextField label={ja.start.field.next} value={next} onChange={setNext} maxLength={80} />
      <Button
        disabled={!valid}
        onClick={async () => {
          const opt = (s: string) => (s.trim() ? s.trim() : null);
          await updateTask(task.id, { title: title.trim(), roughVersion: opt(rough), firstAction: opt(first), nextStep: opt(next) }, Date.now());
          notify({ type: 'saved' });
          onDone();
        }}
      >
        {ja.start.detail.save}
      </Button>
    </Card>
  );
}
