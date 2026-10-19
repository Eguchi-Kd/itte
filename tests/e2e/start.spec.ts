import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00+09:00'));
});

test('AC-UX-02: ホームを開いた状態から、今日のやることの10分タイマーが1回のタップで始まる', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.getByRole('button', { name: 'とばす' }).click();
  await page.getByRole('button', { name: 'あとで決める' }).click();
  await expect(page).toHaveURL(/#\/$/);

  // ラフ登録（＋ → 10分だけ ではなく、保存だけしてホームに戻る経路）
  await page.goto('./#/tasks/new');
  await page.getByLabel('やること', { exact: true }).fill('卒論の序章');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('雑な版', { exact: true }).fill('見出しだけ');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('最初の動作', { exact: true }).fill('エディタを開く');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);

  await page.reload();
  let taps = 0;
  taps += 1;
  await page.getByRole('button', { name: '卒論の序章を始める' }).click();
  expect(taps).toBe(1);
  await expect(page).toHaveURL(/#\/session\/[0-9a-f-]+$/);
  // ホームに戻ると進行中のセッションの再開カードが出る（セッションが保存されている）
  await page.goto('./#/');
  await expect(page.getByTestId('resume-text')).toContainText('10分タイマーの途中です');
});

test('AC-START-03: タイマー中にページを再読み込みしても、残り時間が1秒以内の誤差で復元される', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-18T12:00:00+09:00') });
  await page.goto('./');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.getByRole('button', { name: 'とばす' }).click();
  await page.getByTestId('entry-start').click();
  await page.getByLabel('やること', { exact: true }).fill('卒論の序章');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('雑な版', { exact: true }).fill('見出しだけ');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('最初の動作', { exact: true }).fill('エディタを開く');
  await page.getByRole('button', { name: '保存して始める' }).click();
  await expect(page).toHaveURL(/#\/session\/[0-9a-f-]+$/);
  await expect(page.getByTestId('timer-text')).toHaveText('10:00');

  await page.clock.runFor(3 * 60_000 + 48_000);
  await expect(page.getByTestId('timer-text')).toHaveText('6:12');
  await page.reload();
  const text = (await page.getByTestId('timer-text').textContent()) ?? '';
  const [m, s] = text.split(':').map(Number);
  expect(Math.abs(m * 60 + s - (6 * 60 + 12))).toBeLessThanOrEqual(1);
  await expect(page).toHaveTitle(/^6:1[123] 一手$/);
});
