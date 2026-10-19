import { useCallback, useEffect, useMemo, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { checkIntegrity } from './db/backup';
import { onLaunch } from './db/init';
import type { ID } from './domain/types';
import { routes } from './routes';
import { LaunchContext } from './ui/hooks/launchContext';
import { PwaUpdateProvider } from './ui/hooks/PwaUpdateProvider';

const router = createHashRouter(routes);

export function App() {
  const [escapeSessionId, setEscapeSessionId] = useState<ID | null>(null);
  const [integrityFailed, setIntegrityFailed] = useState(false);

  // 起動時と、前面に戻ったときに §6.3.4 の処理を行う
  useEffect(() => {
    const launch = () =>
      void onLaunch(Date.now()).then(({ abandoned }) => {
        const latest = abandoned.at(-1);
        if (latest) setEscapeSessionId(latest);
        // §6.3.4-6 アイドル時に台帳を検証する。失敗してもアプリは止めない
        const verify = () => void checkIntegrity().then((r) => setIntegrityFailed(!r.ok), () => undefined);
        if ('requestIdleCallback' in window) window.requestIdleCallback(verify);
        else setTimeout(verify, 1000);
      });
    launch();
    const onVisible = () => {
      if (document.visibilityState === 'visible') launch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const clearEscape = useCallback(() => setEscapeSessionId(null), []);
  const launch = useMemo(() => ({ escapeSessionId, clearEscape, integrityFailed }), [escapeSessionId, clearEscape, integrityFailed]);

  return (
    <PwaUpdateProvider>
      <LaunchContext.Provider value={launch}>
        <RouterProvider router={router} />
      </LaunchContext.Provider>
    </PwaUpdateProvider>
  );
}
