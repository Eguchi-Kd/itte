import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// 禁止する識別子（§2.3-3）。大文字小文字を区別しない
const SUBSTRINGS = ['streak', 'badge', 'confetti', 'league', 'leaderboard'];
const WORDS = ['xp'];

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/** camelCase・snake_case・kebab-case を単語に分ける */
function words(text: string): string[] {
  const ids = text.match(/[A-Za-z_$][\w$-]*/g) ?? [];
  return ids.flatMap((id) =>
    id
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[\s_$-]+/)
      .filter(Boolean)
      .map((w) => w.toLowerCase()),
  );
}

export function findForbidden(text: string): string[] {
  const lower = text.toLowerCase();
  const found = SUBSTRINGS.filter((s) => lower.includes(s));
  const ws = new Set(words(text));
  for (const w of WORDS) if (ws.has(w)) found.push(w);
  return found;
}

describe('識別子', () => {
  it('AC-UX-06: src/ のどのファイルにも streak・xp・badge・confetti・league・leaderboard がない', () => {
    const files = listFiles('src');
    expect(files.length).toBeGreaterThan(10);
    const bad = files
      .map((f) => ({ file: f, found: findForbidden(readFileSync(f, 'utf8')) }))
      .filter((r) => r.found.length > 0);
    expect(bad).toEqual([]);
  });

  it('AC-UX-06: 検査そのものが大文字小文字や単語の区切りを問わずに見つけられる', () => {
    expect(findForbidden('const currentStreak = 1')).toEqual(['streak']);
    expect(findForbidden('function BadgeList() {}')).toEqual(['badge']);
    expect(findForbidden('import confetti from "x"')).toEqual(['confetti']);
    expect(findForbidden('LEAGUE_TABLE')).toEqual(['league']);
    expect(findForbidden('showLeaderboard')).toEqual(['leaderboard']);
    expect(findForbidden('let xp = 0; const totalXp = 1; const XP_MAX = 2')).toEqual(['xp']);
    expect(findForbidden('expect(export).toBe(exp)')).toEqual([]);
  });
});
