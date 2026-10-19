import { Suspense, useEffect, useState } from 'react';
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
import { getSettings } from '../../db/repo/common';
import { FlagsContext, useFlagsQuery } from '../hooks/useFlags';
import { EscapeForm } from './start/EscapeForm';
import { StartTaskProvider } from './start/StartTaskProvider';
import { allowsInterruptions, showsBottomNav } from '../routePolicy';

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [quickOpen, setQuickOpen] = useState(false);
  const settings = useSettingsQuery();
  const { needRefresh, update } = useUpdateState();
  const { escapeSessionId, clearEscape } = useLaunch();
  const flags = useFlagsQuery();

  // 設定がまだない（初回や全削除の直後）なら既定値で作る
  useEffect(() => {
    if (settings === null) void getSettings(Date.now());
  }, [settings]);

  // 設定（初期データ）と機能フラグができるまでは何も描かない
  if (!settings || !flags) return null;
  // 未オンボーディングの間は、どのルートもオンボーディングへ（§6.1.2）
  if (!settings.onboarded && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;

  const nav = showsBottomNav(pathname);
  return (
    <SettingsContext.Provider value={settings}>
      <FlagsContext.Provider value={flags}>
        <FeedbackProvider>
          <StartTaskProvider>
            <div className={`app-column ${nav ? 'pb-24' : ''}`}>
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </div>
          </StartTaskProvider>
          {nav && <BottomNav onAdd={() => setQuickOpen(true)} />}
          <QuickActionSheet
            open={quickOpen}
            readingSheet={flags.readingSheet}
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
      </FlagsContext.Provider>
    </SettingsContext.Provider>
  );
}
