import { createContext } from 'react';

/** true の間はコマを描かない。タブの画面の上に逃避ログのシートを出している間など（§5.7-2） */
export const KomaHiddenContext = createContext(false);
