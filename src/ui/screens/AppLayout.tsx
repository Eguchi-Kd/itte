import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ja } from '../../copy/ja';
import { BottomNav } from '../components/BottomNav';
import { Snackbar } from '../components/Snackbar';
import { FeedbackProvider } from '../feedback/FeedbackProvider';
import { useSettings } from '../hooks/useSettings';
import { useUpdateState } from '../hooks/updateContext';
import { allowsInterruptions, showsBottomNav } from '../routePolicy';

export function AppLayout() {
  const { pathname } = useLocation();
  const settings = useSettings();
  const { needRefresh, update } = useUpdateState();

  // 設定（初期データ）ができるまでは何も描かない
  if (!settings) return null;
  // 未オンボーディングの間は、どのルートもオンボーディングへ（§6.1.2）
  if (!settings.onboarded && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;

  const nav = showsBottomNav(pathname);
  return (
    <FeedbackProvider>
      <div className={`app-column ${nav ? 'pb-24' : ''}`}>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </div>
      {nav && <BottomNav onAdd={() => undefined} />}
      {needRefresh && allowsInterruptions(pathname) && (
        <Snackbar text={ja.today.interrupt.update} actionLabel={ja.today.interrupt.updateAction} onAction={update} />
      )}
    </FeedbackProvider>
  );
}
