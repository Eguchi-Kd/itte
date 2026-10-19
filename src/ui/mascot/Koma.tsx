// 案内役「コマ」（§5.7）。将棋の駒の五角形に点の目が2つ。表情は1種類だけで、結果に反応しない
import { useContext } from 'react';
import { useLocation } from 'react-router';
import { ja } from '../../copy/ja';
import { allowsKoma } from '../routePolicy';
import { KomaHiddenContext } from './komaContext';

export type KomaPose = 'wave' | 'point' | 'read' | 'sit';

interface Props {
  pose: KomaPose;
  size?: number;
  /** 吹き出しの文言（src/copy/ja.ts の値を渡す） */
  says?: string;
}

const TILT: Record<KomaPose, number> = { wave: -8, point: 6, read: 0, sit: 0 };

export function Koma({ pose, size = 96, says }: Props) {
  const { pathname } = useLocation();
  const hidden = useContext(KomaHiddenContext);
  // 判定・タイマー・逃避ログ・詰まりシートには出さない（§5.7-2）。タブの画面に重ねた逃避ログのシートの間も出さない
  if (!allowsKoma(pathname) || hidden) return null;
  return (
    <figure className="flex flex-col items-center gap-2" data-testid="koma" data-pose={pose}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={ja.koma.label}
        style={{ transform: `rotate(${TILT[pose]}deg)` }}
      >
        {pose === 'sit' && <ellipse cx="50" cy="93" rx="30" ry="4" fill="var(--border)" />}
        <path
          d="M50 6 L80 22 L90 88 Q90 90 88 90 L12 90 Q10 90 10 88 L20 22 Z"
          fill="var(--wood)"
          stroke="var(--wood-edge)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="38" cy="50" r="5" fill="var(--wood-edge)" />
        <circle cx="62" cy="50" r="5" fill="var(--wood-edge)" />
        {pose === 'wave' && (
          <path d="M88 30 q8 -6 6 -16" fill="none" stroke="var(--wood-edge)" strokeWidth="4" strokeLinecap="round" />
        )}
        {pose === 'point' && <path d="M84 70 l12 8 l-12 8 z" fill="var(--wood-edge)" />}
        {pose === 'read' && (
          <rect x="28" y="66" width="44" height="18" rx="3" fill="var(--surface)" stroke="var(--wood-edge)" strokeWidth="3" />
        )}
      </svg>
      {says && <figcaption className="text-body text-text-2 text-center">{says}</figcaption>}
    </figure>
  );
}
