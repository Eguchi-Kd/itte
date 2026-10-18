import { defineConfig, devices } from '@playwright/test';

// 4173 は他のアプリと衝突しやすいので避ける。別のサーバーを誤って使わないよう、既存のサーバーは使い回さない
const PORT = 4319;
const BASE = process.env.VITE_BASE ?? '/itte/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    timezoneId: 'Asia/Tokyo',
    locale: 'ja-JP',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: false,
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
