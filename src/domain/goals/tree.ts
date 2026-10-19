// 段の木（§8.7.2）【刻】
import type { Goal, ID } from '../types';

export { defaultComparator } from './goal';

export interface GoalTreeNode {
  goal: Goal;
  depth: number;
  children: GoalTreeNode[];
}

/** 祖先の数（最上位は0） */
export function depth(goal: Goal, byId: ReadonlyMap<ID, Goal>): number {
  let d = 0;
  let cur = goal;
  const seen = new Set<ID>();
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parentId) as Goal;
    d += 1;
  }
  return d;
}

/** 最上位の段 */
export function rootOf(goal: Goal, byId: ReadonlyMap<ID, Goal>): Goal {
  let cur = goal;
  const seen = new Set<ID>();
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parentId) as Goal;
  }
  return cur;
}

/** recutOfId の鎖の長さ（元の段が先頭なら0） */
function recutIndex(goal: Goal, byId: ReadonlyMap<ID, Goal>): number {
  let n = 0;
  let cur = goal;
  while (cur.recutOfId && byId.has(cur.recutOfId) && n < 1000) {
    cur = byId.get(cur.recutOfId) as Goal;
    n += 1;
  }
  return n;
}

/**
 * parentId で木を組む。切り直しの段は元の段の兄弟として、recutOfId の鎖の順に並べる。
 * 同じ親の兄弟は「鎖の先頭の作成順 → 鎖の中の順」で並ぶ
 */
export function buildTree(goals: readonly Goal[]): GoalTreeNode[] {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const chainHead = (g: Goal): Goal => {
    let cur = g;
    let n = 0;
    while (cur.recutOfId && byId.has(cur.recutOfId) && n < 1000) {
      cur = byId.get(cur.recutOfId) as Goal;
      n += 1;
    }
    return cur;
  };
  const sortSiblings = (list: Goal[]) =>
    list.sort((a, b) => {
      const ha = chainHead(a);
      const hb = chainHead(b);
      if (ha.id !== hb.id) return ha.createdAt - hb.createdAt || (ha.id < hb.id ? -1 : 1);
      return recutIndex(a, byId) - recutIndex(b, byId);
    });
  const childrenOf = new Map<ID | null, Goal[]>();
  for (const g of goals) {
    const key = g.parentId && byId.has(g.parentId) ? g.parentId : null;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), g]);
  }
  const build = (parent: ID | null, d: number): GoalTreeNode[] =>
    sortSiblings(childrenOf.get(parent) ?? []).map((g) => ({ goal: g, depth: d, children: build(g.id, d + 1) }));
  return build(null, 0);
}

/** 木を上から順に平らにする（インデント表示用） */
export function flattenTree(nodes: readonly GoalTreeNode[]): GoalTreeNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

/** 深さ6以上（最上位から5段より下）の段には「最上位から{n}段下」を併記する（§6.8.2） */
export const DEEP_DEPTH = 5;
