// ルートごとの画面の形式（§6.1.2）。下部タブ・割り込み・コマを出してよいかをここで決める
import { matchPath } from 'react-router';

export type RouteKind = 'tab' | 'list' | 'lesson' | 'wizard' | 'timer' | 'sheet' | 'normal';

const ROUTE_KINDS: [pattern: string, kind: RouteKind][] = [
  ['/', 'tab'],
  ['/board', 'tab'],
  ['/review', 'tab'],
  ['/library', 'tab'],
  ['/library/*', 'list'],
  ['/onboarding', 'lesson'],
  ['/habits/new', 'wizard'],
  ['/habits/:id/edit', 'normal'],
  ['/habits/:id', 'normal'],
  ['/tasks/new', 'wizard'],
  ['/tasks/:id', 'normal'],
  ['/session/:id/end', 'lesson'],
  ['/session/:id', 'timer'],
  ['/escape/new', 'sheet'],
  ['/daily', 'lesson'],
  ['/board/items/new', 'sheet'],
  ['/board/items/:id', 'normal'],
  ['/moves/new', 'lesson'],
  ['/moves/quick', 'sheet'],
  ['/moves/:id', 'normal'],
  ['/goals/new', 'lesson'],
  ['/goals/:id/kizami', 'lesson'],
  ['/goals/:id/recut', 'lesson'],
  ['/goals/:id/extend', 'sheet'],
  ['/goals/:id', 'normal'],
  ['/judge/:goalId', 'lesson'],
  ['/measure/new', 'sheet'],
  ['/review/weekly/:weekStart', 'lesson'],
];

/** コマを出さない画面（§5.7-2）。判定、タイマー（詰まりシートはこの上のモーダル）、逃避ログ */
const NO_KOMA = ['/judge/:goalId', '/session/:id', '/escape/new'];

export function routeKind(pathname: string): RouteKind {
  for (const [pattern, kind] of ROUTE_KINDS) {
    if (matchPath({ path: pattern, end: true }, pathname)) return kind;
  }
  return 'normal';
}

/** 下部タブはタブのルートと記録庫の一覧でだけ出す（§6.1.1） */
export function showsBottomNav(pathname: string): boolean {
  const k = routeKind(pathname);
  return k === 'tab' || k === 'list';
}

/** 更新・バックアップの割り込みはタブ画面でだけ出す（X7、D28） */
export function allowsInterruptions(pathname: string): boolean {
  return routeKind(pathname) === 'tab';
}

export function allowsKoma(pathname: string): boolean {
  return !NO_KOMA.some((p) => matchPath({ path: p, end: true }, pathname));
}
