import { useEffect } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { onLaunch } from './db/init';
import { routes } from './routes';
import { PwaUpdateProvider } from './ui/hooks/PwaUpdateProvider';

const router = createHashRouter(routes);

export function App() {
  useEffect(() => {
    void onLaunch(Date.now());
    const onVisible = () => {
      if (document.visibilityState === 'visible') void onLaunch(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return (
    <PwaUpdateProvider>
      <RouterProvider router={router} />
    </PwaUpdateProvider>
  );
}
