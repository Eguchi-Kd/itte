import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// AC-UX-16 は手動の確認だが、トークンの組み合わせの比はここで先に確かめる（WCAG 2.x の相対輝度）
const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  return out;
}

const light = tokens(css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')));
const dark = { ...light, ...tokens(css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('コントラスト', () => {
  for (const [theme, t] of [
    ['ライト', light],
    ['ダーク', dark],
  ] as const) {
    it(`AC-UX-16: ${theme}で、本文（text、text-2）と背景（bg、surface、surface-2、primary-tint）の比が 4.5:1 以上`, () => {
      for (const fg of ['text', 'text-2']) {
        for (const bg of ['bg', 'surface', 'surface-2', 'primary-tint']) {
          expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});

describe('ボタンの文字', () => {
  it('AC-UX-16: 主ボタンと削除ボタンの文字は、ライト（白）とダーク（背景色）の両方で 4.5:1 以上', () => {
    const index = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');
    expect(index).toMatch(/prefers-color-scheme: dark\)\s*\{\s*\.btn-primary,\s*\.btn-danger\s*\{\s*color: var\(--bg\);/);
    for (const bg of ['primary', 'danger']) {
      expect(contrast('#ffffff', light[bg]), `light ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.bg, dark[bg]), `dark ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
