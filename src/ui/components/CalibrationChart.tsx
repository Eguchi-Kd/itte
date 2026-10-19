// 符号付き誤差の時系列（§5.8）。ゼロ線を中央に、上に「予想が高め」、下に「予想が低め」。
// 色は単色（--primary）で、正負は位置とラベルで区別する（§5.2）
import { ja } from '../../copy/ja';

interface Props {
  values: number[];
  label: string;
}

const W = 320;
const H = 180;
const PAD = 24;

export function CalibrationChart({ values, label }: Props) {
  const max = Math.max(0.5, ...values.map((v) => Math.abs(v)));
  const zeroY = H / 2;
  const scale = (H / 2 - PAD) / max;
  const step = values.length > 1 ? (W - 2 * PAD) / (values.length - 1) : 0;
  const points = values.map((v, i) => ({ x: PAD + i * step + (values.length === 1 ? (W - 2 * PAD) / 2 : 0), y: zeroY - v * scale, v }));
  return (
    <figure aria-label={label} data-testid="calibration-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        <line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} stroke="var(--text-2)" strokeWidth="1.5" data-testid="zero-line" />
        <text x={PAD} y={14} fontSize="11" fill="var(--text-2)">
          {ja.goals.calib.over}
        </text>
        <text x={PAD} y={H - 4} fontSize="11" fill="var(--text-2)">
          {ja.goals.calib.under}
        </text>
        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
          />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--primary)" data-testid="calibration-point" data-value={p.v} />
        ))}
      </svg>
    </figure>
  );
}

/** 予想 ÷ 閾値 と 実測 ÷ 閾値 の散布図（対角線つき） */
export function CalibrationScatter({ points, label }: { points: { x: number; y: number }[]; label: string }) {
  const max = Math.max(1.5, ...points.flatMap((p) => [p.x, p.y]));
  const min = Math.min(0, ...points.flatMap((p) => [p.x, p.y]));
  const S = 220;
  const toX = (v: number) => PAD + ((v - min) / (max - min)) * (S - 2 * PAD);
  const toY = (v: number) => S - PAD - ((v - min) / (max - min)) * (S - 2 * PAD);
  return (
    <figure aria-label={label} data-testid="calibration-scatter">
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[280px]" role="img" aria-label={label}>
        <line x1={toX(min)} y1={toY(min)} x2={toX(max)} y2={toY(max)} stroke="var(--text-2)" strokeDasharray="4 4" />
        <line x1={PAD} y1={S - PAD} x2={S - PAD} y2={S - PAD} stroke="var(--border)" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={S - PAD} stroke="var(--border)" />
        <text x={S - PAD} y={S - 6} fontSize="10" textAnchor="end" fill="var(--text-2)">
          {ja.goals.calib.scatterX}
        </text>
        <text x={4} y={14} fontSize="10" fill="var(--text-2)">
          {ja.goals.calib.scatterY}
        </text>
        {points.map((p, i) => (
          <circle key={i} cx={toX(p.x)} cy={toY(p.y)} r="4" fill="var(--primary)" />
        ))}
      </svg>
    </figure>
  );
}
