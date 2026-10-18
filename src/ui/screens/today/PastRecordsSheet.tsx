import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { addDays } from '../../../domain/dates';
import { formatAmount, formatDateShort } from '../../../domain/display';
import { isScheduled } from '../../../domain/habits/schedule';
import type { Habit, HabitLog, LocalDate, ReasonTag } from '../../../domain/types';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';

interface Props {
  open: boolean;
  onClose: () => void;
  today: LocalDate;
  habits: Habit[];
  logs: HabitLog[];
  tags: ReasonTag[];
  onDone: (habitId: string, date: LocalDate) => void;
  onMissed: (habitId: string, date: LocalDate, tagIds: string[]) => void;
  onUndo: (habitId: string, date: LocalDate) => void;
}

/** 過去の記録を直す（§6.5.6）。今日と過去3日の4日分だけを操作できる */
export function PastRecordsSheet({ open, onClose, today, habits, logs, tags, onDone, onMissed, onUndo }: Props) {
  const dates = [0, 1, 2, 3].map((n) => addDays(today, -n));
  const [date, setDate] = useState<LocalDate>(addDays(today, -1));
  const [missedOpen, setMissedOpen] = useState<string | null>(null);
  const selected = dates.includes(date) ? date : dates[0];
  const scheduled = habits.filter((h) => isScheduled(h, selected));

  return (
    <BottomSheet open={open} onClose={onClose} title={ja.today.past.title} testId="past-sheet">
      <ChipGroup label={ja.today.past.dates}>
        {dates.map((d) => (
          <ChoiceChip key={d} selected={d === selected} onToggle={() => setDate(d)}>
            {formatDateShort(d)}
          </ChoiceChip>
        ))}
      </ChipGroup>
      <ul className="mt-4 flex flex-col gap-3 pb-2">
        {scheduled.length === 0 && <li className="text-body text-text-2">{ja.today.past.none}</li>}
        {scheduled.map((h) => {
          const log = logs.find((l) => l.habitId === h.id && l.date === selected);
          const status = !log
            ? null
            : log.done
              ? fill(ja.today.node.recordedAmount, { amount: formatAmount(log.amount, h.unit) })
              : ja.common.missing;
          return (
            <li key={h.id} className="card p-3" data-testid={`past-${h.id}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-label">{h.name}</span>
                {status && <span className="text-caption text-text-2">{status}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="md" onClick={() => onDone(h.id, selected)}>
                  {ja.today.past.done}
                </Button>
                <Button size="md" variant="secondary" onClick={() => setMissedOpen(missedOpen === h.id ? null : h.id)}>
                  {ja.today.past.missed}
                </Button>
                {log && (
                  <Button size="md" variant="ghost" onClick={() => onUndo(h.id, selected)}>
                    {ja.today.past.undo}
                  </Button>
                )}
              </div>
              {missedOpen === h.id && (
                <ChipGroup label={ja.today.interrupt.reasonTags} className="mt-2">
                  {tags
                    .filter((t) => !t.archived)
                    .map((t) => (
                      <ChoiceChip
                        key={t.id}
                        selected={!!log && !log.done && log.reasonTagIds.includes(t.id)}
                        onToggle={() => {
                          onMissed(h.id, selected, [t.id]);
                          setMissedOpen(null);
                        }}
                      >
                        {t.label}
                      </ChoiceChip>
                    ))}
                </ChipGroup>
              )}
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
