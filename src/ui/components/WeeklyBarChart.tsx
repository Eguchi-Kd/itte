// 12週の棒（実行回数）と予定回数の目安線（§5.8）。Recharts を含むので遅延読み込みする
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { parseLocalDate } from '../../domain/dates';
import type { WeekPoint } from '../../domain/habits/stats';

interface Props {
  data: WeekPoint[];
  label: string;
}

const tick = (ws: string) => {
  const d = parseLocalDate(ws);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function WeeklyBarChart({ data, label }: Props) {
  return (
    <figure aria-label={label} className="h-48 w-full" data-testid="weekly-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="weekStart" tickFormatter={tick} tick={{ fill: 'var(--text-2)', fontSize: 11 }} interval={2} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--text-2)', fontSize: 11 }} />
          <Bar dataKey="doneCount" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Line
            dataKey="scheduledCount"
            type="step"
            stroke="var(--text-2)"
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}
