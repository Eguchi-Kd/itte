import { useMemo, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { UpdateContext } from './updateContext';

/** registerType: 'prompt'（D28）。更新は利用者が「更新」を押したときだけ行う */
export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const value = useMemo(
    () => ({ needRefresh, update: () => void updateServiceWorker(true) }),
    [needRefresh, updateServiceWorker],
  );
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}
