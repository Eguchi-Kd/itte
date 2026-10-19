import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00+09:00'));
});

test('AC-BOARD-12: 決めかけの手で候補を選んで確定すると decidedAt が記録され、ホームに戻る', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.getByRole('button', { name: 'とばす' }).click();
  await page.getByTestId('entry-move').click();
  await expect(page).toHaveURL(/#\/moves\/new$/);

  await page.getByLabel('どんな局面?', { exact: true }).fill('飲み会の誘いへの返事');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('候補 1', { exact: true }).fill('行く');
  await page.getByLabel('候補 2', { exact: true }).fill('断る');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('button', { name: 'あとで決める' }).click();
  await expect(page).toHaveURL(/#\/$/);

  // ホームの決めかけの手: 候補を選ぶ → 決める（2タップ）
  const node = page.locator('[data-testid^="decide-node-"]');
  await expect(node).toHaveAttribute('data-state', 'next');
  await node.getByRole('radio', { name: '断る' }).click();
  await node.getByRole('button', { name: '決める' }).click();
  await expect(node).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$/);

  // 決めた手は再読み込みしても決めかけに戻らない（decidedAt が保存されている）
  await page.reload();
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.getByTestId('empty-state')).toHaveCount(0);
  await expect(page.locator('[data-testid^="decide-node-"]')).toHaveCount(0);
  await page.goto('./#/library/moves');
  await expect(page.getByTestId('move-list')).toContainText('決定済み');
});
