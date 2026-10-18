import { expect, test } from '@playwright/test';

test.describe('オンボーディング', () => {
  for (const hash of ['#/', '#/library', '#/habits/new', '#/review']) {
    test(`AC-CORE-06: 未オンボーディングで ${hash} を開くと #/onboarding に移り、下部タブが表示されない`, async ({ page }) => {
      await page.goto(`./${hash}`);
      await expect(page).toHaveURL(/#\/onboarding$/);
      await expect(page.getByRole('button', { name: 'はじめる' })).toBeVisible();
      await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
    });
  }

  test('AC-CORE-07: 診断をとばして「あとで決める」でホームに移り、再読み込みしてもホームのまま', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'はじめる' }).click();
    await page.getByRole('button', { name: 'とばす' }).click();
    await page.getByRole('button', { name: 'あとで決める' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
  });
});
