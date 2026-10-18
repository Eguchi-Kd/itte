import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ja } from '../../copy/ja';
import { fill } from '../../copy/fill';
import { addDays, parseLocalDate, toLocalDate } from '../../domain/dates';
import { formatDateShort, weekdayLabel } from '../../domain/display';
import type { LocalDate } from '../../domain/types';

interface Props {
  today: LocalDate;
  isScheduled: (d: LocalDate) => boolean;
  doneDates: ReadonlySet<LocalDate>;
}

/** 月間カレンダー（§5.8）。予定日は枠、記録済みは塗り、予定外の実行は小さな点。色だけでなく印と文字でも示す */
export function MonthCalendar({ today, isScheduled, doneDates }: Props) {
  const t = parseLocalDate(today);
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const first = toLocalDate(new Date(ym.y, ym.m, 1, 12));
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = parseLocalDate(first).getDay();
  const cells: (LocalDate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => addDays(first, i)),
  ];
  const move = (n: number) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  return (
    <div data-testid="month-calendar">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label={ja.habits.calendar.prev} className="flex size-12 items-center justify-center" onClick={() => move(-1)}>
          <ChevronLeft size={20} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <p className="text-label">{fill(ja.habits.calendar.month, { y: ym.y, m: ym.m + 1 })}</p>
        <button type="button" aria-label={ja.habits.calendar.next} className="flex size-12 items-center justify-center" onClick={() => move(1)}>
          <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <span key={d} className="text-caption text-text-2" role="columnheader">
            {weekdayLabel(d)}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const scheduled = isScheduled(d);
          const done = doneDates.has(d);
          const state = done && scheduled ? 'done' : done ? 'extra' : scheduled ? 'scheduled' : 'none';
          const label = [
            formatDateShort(d),
            state === 'done' ? ja.habits.calendar.done : state === 'extra' ? ja.habits.calendar.extra : state === 'scheduled' ? ja.habits.calendar.scheduled : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <span
              key={d}
              role="gridcell"
              aria-label={label}
              data-state={state}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-caption ${
                state === 'done' ? 'bg-primary-tint' : ''
              } ${scheduled ? 'border-2 border-border' : ''} ${d === today ? 'font-bold' : ''}`}
            >
              {parseLocalDate(d).getDate()}
              {state === 'done' && <Check size={12} strokeWidth={3} className="text-primary" aria-hidden="true" />}
              {state === 'extra' && <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-caption text-text-2">
        {[ja.habits.calendar.scheduled, ja.habits.calendar.done, ja.habits.calendar.extra].join(ja.common.separator)}
      </p>
    </div>
  );
}
