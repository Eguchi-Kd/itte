import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}
interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

/** Screen Wake Lock で画面の消灯を防ぐ（対応環境のみ）。画面離脱時に解放し、前面に戻ったら取り直す */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!active || !wl) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        const s = await wl.request('screen');
        if (disposed) void s.release();
        else sentinel = s;
      } catch {
        // 取れない環境（省電力モードなど）では何もしない
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
