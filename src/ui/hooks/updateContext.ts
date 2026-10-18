import { createContext, useContext } from 'react';

export interface UpdateState {
  /** Service Worker の新しい版が待機している */
  needRefresh: boolean;
  update: () => void;
}

export const UpdateContext = createContext<UpdateState>({ needRefresh: false, update: () => undefined });

export function useUpdateState(): UpdateState {
  return useContext(UpdateContext);
}
