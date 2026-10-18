import { expect, test } from '@playwright/test';

test.describe('ビルド成果物', () => {
  test('マニフェストが §10.2 のとおりで、アイコンが取得できる', async ({ request }) => {
    const res = await request.get('manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m).toMatchObject({
      name: '一手',
      short_name: '一手',
      lang: 'ja',
      theme_color: '#2563EB',
      background_color: '#F7F7F4',
      display: 'standalone',
      orientation: 'portrait',
      start_url: './',
      scope: './',
    });
    expect(m.icons).toEqual([
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ]);
    for (const [file, size] of [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['apple-touch-icon.png', 180],
    ] as const) {
      const icon = await request.get(file);
      expect(icon.ok()).toBe(true);
      expect(icon.headers()['content-type']).toContain('image/png');
      const buf = await icon.body();
      expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
      expect(buf.readUInt32BE(16)).toBe(size);
      expect(buf.readUInt32BE(20)).toBe(size);
    }
  });

  test('index.html に CSP、マニフェスト、apple-touch-icon が入り、外部の URL を読まない', async ({ request }) => {
    const html = await (await request.get('./')).text();
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("connect-src 'self'");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon" href="apple-touch-icon.png"');
    expect(html).not.toMatch(/(src|href)="https?:\/\//);
  });

  test('Service Worker がビルドされ、アイコンをプリキャッシュする', async ({ request }) => {
    const sw = await request.get('sw.js');
    expect(sw.ok()).toBe(true);
    const text = await sw.text();
    expect(text).toContain('icon-512.png');
    expect(text).toContain('index.html');
  });
});
