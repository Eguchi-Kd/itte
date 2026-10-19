import { ja } from '../../copy/ja';
import { addDays, parseLocalDate, toLocalDate } from '../../domain/dates';
import type { LocalDate } from '../../domain/types';
import { ChoiceChip, ChipGroup } from './ChoiceChip';

interface Props {
  label: string;
  value: LocalDate | '';
  onChange: (d: LocalDate) => void;
  today: LocalDate;
  /** これより前の日は選べない（既定は明日） */
  min?: LocalDate;
}

function monthsLater(today: LocalDate, n: number): LocalDate {
  const d = parseLocalDate(today);
  d.setMonth(d.getMonth() + n);
  return toLocalDate(d);
}

/** 「1週間後」「2週間後」「1か月後」「3か月後」のチップと日付入力（§5.8） */
export function DateChips({ label, value, onChange, today, min = addDays(today, 1) }: Props) {
  const presets: [string, LocalDate][] = [
    [ja.goals.dateChips.week1, addDays(today, 7)],
    [ja.goals.dateChips.week2, addDays(today, 14)],
    [ja.goals.dateChips.month1, monthsLater(today, 1)],
    [ja.goals.dateChips.month3, monthsLater(today, 3)],
  ];
  return (
    <div className="flex flex-col gap-2">
      <ChipGroup label={label}>
        {presets
          .filter(([, d]) => d >= min)
          .map(([text, d]) => (
            <ChoiceChip key={text} selected={value === d} onToggle={() => onChange(d)}>
              {text}
            </ChoiceChip>
          ))}
      </ChipGroup>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-text-2">{ja.goals.dateChips.pick}</span>
        <input
          type="date"
          value={value}
          min={min}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-3 text-body"
          aria-label={label}
        />
      </label>
    </div>
  );
}
