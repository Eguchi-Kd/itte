import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ja } from '../../src/copy/ja';
import { copyByKey, fill } from '../../src/copy/fill';

const FORBIDDEN_WORDS = ['すごい', 'えらい', '頑張', '失敗', 'サボ', '達成', '目標'];
const EXCLAMATION = /[!！]/;
const EMOJI = /\p{Extended_Pictographic}/u;

function collectStrings(value: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof value === 'string') out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectStrings(v, path ? `${path}.${k}` : k, out);
  }
}

function violations(text: string): string[] {
  const found: string[] = FORBIDDEN_WORDS.filter((w) => text.includes(w));
  if (EXCLAMATION.test(text)) found.push('感嘆符');
  if (EMOJI.test(text)) found.push('絵文字');
  return found;
}

describe('文言', () => {
  it('AC-UX-05: ja.ts の全文言に禁止語・感嘆符・絵文字が含まれない', () => {
    const strings: { path: string; text: string }[] = [];
    collectStrings(ja, '', strings);
    expect(strings.length).toBeGreaterThan(100);
    const bad = strings.map((s) => ({ ...s, v: violations(s.text) })).filter((s) => s.v.length > 0);
    expect(bad).toEqual([]);
  });

  it('AC-UX-05: ja.ts のファイル全体（コメントを含む）にも禁止語・感嘆符・絵文字がない', () => {
    const source = readFileSync('src/copy/ja.ts', 'utf8');
    expect(violations(source)).toEqual([]);
  });

  it('AC-UX-05: 検査そのものが禁止語・感嘆符・絵文字を見つけられる', () => {
    expect(violations('目標を達成')).toEqual(['達成', '目標']);
    expect(violations('記録しました!')).toEqual(['感嘆符']);
    expect(violations('記録しました！')).toEqual(['感嘆符']);
    expect(violations('記録しました\u{1F389}')).toEqual(['絵文字']);
    expect(violations('記録しました')).toEqual([]);
  });

  it('fill と copyByKey', () => {
    expect(fill(ja.habits.ratio28, { done: 4, scheduled: 6 })).toBe('28日間で 4/6 回');
    expect(copyByKey('errors.outOfWindow')).toBe('記録できるのは今日と過去3日までです');
    expect(copyByKey('errors.nothing')).toBe(ja.errors.unknown);
  });
});
