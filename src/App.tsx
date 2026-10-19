import { useCallback, useEffect, useMemo, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { onLaunch } from './db/init';
import type { ID } from './domain/types';
import { routes } from './routes';
import { LaunchContext } from './ui/hooks/launchContext';
import { PwaUpdateProvider } from './ui/hooks/PwaUpdateProvider';

const router = createHashRouter(routes);

export function App() {
  const [escapeSessionId, setEscapeSessionId] = useState<ID | null>(null);

  // 起動時と、前面に戻ったときに §6.3.4 の処理を行う
  useEffect(() => {
    const launch = () =>
      void onLaunch(Date.now()).then(({ abandoned }) => {
        const latest = abandoned.at(-1);
        if (latest) setEscapeSessionId(latest);
      });
    launch();
    const onVisible = () => {
      if (document.visibilityState === 'visible') launch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const clearEscape = useCallback(() => setEscapeSessionId(null), []);
  const launch = useMemo(() => ({ escapeSessionId, clearEscape }), [escapeSessionId, clearEscape]);

  return (
    <PwaUpdateProvider>
      <LaunchContext.Provider value={launch}>
        <RouterProvider router={router} />
      </LaunchContext.Provider>
    </PwaUpdateProvider>
  );
}
