import { expect, type Page } from '@playwright/test';

/** オンボーディングを診断スキップで終え、入口の4択で習慣作成へ進む */
export async function onboardToHabit(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.getByRole('button', { name: 'とばす' }).click();
  await page.getByTestId('entry-habit').click();
  await expect(page).toHaveURL(/#\/habits\/new$/);
}

/** 習慣作成ウィザードを最小の入力で終える（毎日 7:00、机、10分） */
export async function createHabit(page: Page, name: string) {
  await page.getByRole('radio', { name: '始めたい' }).click();
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('行動名', { exact: true }).fill(name);
  await page.getByRole('radio', { name: '分', exact: true }).click();
  await page.getByLabel('1回の量', { exact: true }).fill('10');
  await page.getByLabel('絶対にできる量', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('時刻', { exact: true }).fill('07:00');
  await page.getByLabel('場所', { exact: true }).fill('机');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('button', { name: 'この内容で始める' }).click();
  await expect(page).toHaveURL(/#\/$/);
}
