import { ja } from './ja';

/** '{n}件' の {n} を差し込む */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** 'errors.outOfWindow' のようなキーで文言を引く。見つからなければ errors.unknown */
export function copyByKey(key: string): string {
  let cur: unknown = ja;
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(part in cur)) return ja.errors.unknown;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : ja.errors.unknown;
}
