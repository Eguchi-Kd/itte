// タイムゾーンは環境変数の前置きではなくここで設定する（§11.3。Windows でも動かすため）
process.env.TZ = 'Asia/Tokyo';

import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_NAME } from './src/config';

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'";

// 本番ビルドの index.html にだけ CSP を入れる（§10.4。開発サーバーは HMR の WebSocket があるので入れない）
function cspPlugin(): Plugin {
  return {
    name: 'itte-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/itte/',
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        lang: 'ja',
        theme_color: '#2563EB',
        background_color: '#F7F7F4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    // 画面のテストは遅延読み込みと IndexedDB を含み、並列実行で重くなるため
    testTimeout: 20_000,
  },
});
