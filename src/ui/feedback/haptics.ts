// 振動（§5.6）。navigator.vibrate がない端末（iOS Safari）では何もしない
export type HapticId = 'recorded' | 'timerEnd';

const PATTERNS: Record<HapticId, number | number[]> = {
  recorded: 8,
  timerEnd: [20, 40, 20],
};

export function vibrate(id: HapticId): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[id]);
  } catch {
    // 振動できない環境では何もしない
  }
}
