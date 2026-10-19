import { Suspense, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { ja } from '../../copy/ja';
import { BottomNav } from '../components/BottomNav';
import { BottomSheet } from '../components/BottomSheet';
import { QuickActionSheet } from '../components/QuickActionSheet';
import { Snackbar } from '../components/Snackbar';
import { FeedbackProvider } from '../feedback/FeedbackProvider';
import { SettingsContext, useSettingsQuery } from '../hooks/useSettings';
import { useUpdateState } from '../hooks/updateContext';
import { useLaunch } from '../hooks/launchContext';
import { EscapeForm } from './start/EscapeForm';
import { allowsInterruptions, showsBottomNav } from '../routePolicy';

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [quickOpen, setQuickOpen] = useState(false);
  const settings = useSettingsQuery();
  const { needRefresh, update } = useUpdateState();
  const { escapeSessionId, clearEscape } = useLaunch();

  // 設定（初期データ）ができるまでは何も描かない
  if (!settings) return null;
  // 未オンボーディングの間は、どのルートもオンボーディングへ（§6.1.2）
  if (!settings.onboarded && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;

  const nav = showsBottomNav(pathname);
  return (
    <SettingsContext.Provider value={settings}>
      <FeedbackProvider>
        <div className={`app-column ${nav ? 'pb-24' : ''}`}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </div>
        {nav && <BottomNav onAdd={() => setQuickOpen(true)} />}
        <QuickActionSheet
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          onNavigate={(to) => {
            setQuickOpen(false);
            navigate(to);
          }}
        />
        {/* 起動時に放置セッションを閉じたら、逃避ログを1回だけ促す（§6.3.4-2）。レッスン中などは割り込まない */}
        <BottomSheet
          open={escapeSessionId !== null && allowsInterruptions(pathname)}
          onClose={clearEscape}
          title={ja.start.escapeIntro}
          testId="escape-sheet"
        >
          {escapeSessionId && (
            <div className="pb-2">
              <EscapeForm sessionId={escapeSessionId} onDone={clearEscape} />
            </div>
          )}
        </BottomSheet>
        {needRefresh && allowsInterruptions(pathname) && (
          <Snackbar
            text={ja.today.interrupt.update}
            actionLabel={ja.today.interrupt.updateAction}
            onAction={update}
          />
        )}
      </FeedbackProvider>
    </SettingsContext.Provider>
  );
}
