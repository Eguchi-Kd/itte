import { useEffect, useState } from 'react';
import { logicalDate } from '../../domain/dates';
import type { EpochMs, LocalDate } from '../../domain/types';

/** 現在時刻（§11.6）。visibilitychange で即時に更新する */
export function useNow(intervalMs = 60000): EpochMs {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** 今日（論理日）。4:00 をまたぐと変わる */
export function useToday(): LocalDate {
  return logicalDate(useNow(60000));
}
