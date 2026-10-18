import { expect, test, type Locator, type Page } from '@playwright/test';

// 2026-10-18（日）12:00 JST
const BASE_TIME = new Date('2026-10-18T12:00:00+09:00');

/** タップ数を数えながら押す */
function tapper() {
  let count = 0;
  return {
    tap: async (l: Locator) => {
      count += 1;
      await l.click();
    },
    get count() {
      return count;
    },
  };
}

async function onboardSkip(page: Page, t = tapper()) {
  await page.goto('./');
  await t.tap(page.getByRole('button', { name: 'はじめる' }));
  await t.tap(page.getByRole('button', { name: 'とばす' }));
  await t.tap(page.getByTestId('entry-habit'));
  await expect(page).toHaveURL(/#\/habits\/new$/);
}

async function createHabit(page: Page, name: string, t = tapper()) {
  await t.tap(page.getByRole('radio', { name: '始めたい' }));
  await t.tap(page.getByRole('button', { name: 'つぎへ' }));
  await page.getByLabel('行動名', { exact: true }).fill(name);
  await t.tap(page.getByRole('radio', { name: '分', exact: true }));
  await page.getByLabel('1回の量', { exact: true }).fill('10');
  await page.getByLabel('絶対にできる量', { exact: true }).fill('5');
  await t.tap(page.getByRole('button', { name: 'つぎへ' }));
  await page.getByLabel('時刻', { exact: true }).fill('07:00');
  await page.getByLabel('場所', { exact: true }).fill('机');
  await t.tap(page.getByRole('button', { name: 'つぎへ' }));
  await expect(page.getByTestId('intention')).toHaveText(`毎日の7:00に、机で、${name}を10分`);
  await t.tap(page.getByRole('button', { name: 'この内容で始める' }));
  await expect(page).toHaveURL(/#\/$/);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(BASE_TIME);
});

test('オンボーディング（診断スキップ）→ 習慣を作る → ホームで「やった」→ 取り消す → もう一度「やった」', async ({ page }) => {
  const t = tapper();
  await onboardSkip(page, t);
  await createHabit(page, '英単語', t);

  const node = page.locator('[data-testid^="habit-node-"]');
  await expect(node).toHaveAttribute('data-state', 'next');
  await t.tap(page.getByRole('button', { name: '英単語をやったと記録する' }));
  await expect(node).toHaveAttribute('data-state', 'done');
  await expect(node.getByTestId('recorded')).toHaveText('記録済み 10分');
  // オンボーディング開始から最初の記録まで（診断スキップ）
  expect(t.count).toBeLessThanOrEqual(15);

  const snackbar = page.getByTestId('snackbar');
  await expect(snackbar).toContainText('記録しました');
  await snackbar.getByRole('button', { name: '取り消す' }).click();
  await expect(node).toHaveAttribute('data-state', 'next');

  await page.getByRole('button', { name: '英単語をやったと記録する' }).click();
  await expect(node).toHaveAttribute('data-state', 'done');
  await page.reload();
  await expect(page.locator('[data-testid^="habit-node-"]')).toHaveAttribute('data-state', 'done');
});

test('AC-UX-01: ホームを開いた状態から、習慣の記録が1回のタップで保存される', async ({ page }) => {
  await onboardSkip(page);
  await createHabit(page, '英単語');
  await page.reload();
  const t = tapper();
  await t.tap(page.getByRole('button', { name: '英単語をやったと記録する' }));
  expect(t.count).toBe(1);
  await page.reload();
  await expect(page.locator('[data-testid^="habit-node-"]')).toHaveAttribute('data-state', 'done');
});

test('AC-HAB-07: ホームで「やった」→ スナックバーの「取り消す」で、その日の記録が消え、再読み込みしても戻らない', async ({
  page,
}) => {
  await onboardSkip(page);
  await createHabit(page, '英単語');
  await page.getByRole('button', { name: '英単語をやったと記録する' }).click();
  await page.getByTestId('snackbar').getByRole('button', { name: '取り消す' }).click();
  await expect(page.locator('[data-testid^="habit-node-"]')).toHaveAttribute('data-state', 'next');
  await page.reload();
  await expect(page.locator('[data-testid^="habit-node-"]')).toHaveAttribute('data-state', 'next');
  await expect(page.getByTestId('recorded')).toHaveCount(0);
});

test('AC-UX-03: 記録なしの理由カードで、タグ1回のタップで記録され、次のカードに進む', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00+09:00'));
  await onboardSkip(page);
  await createHabit(page, '英単語');

  await page.clock.setFixedTime(BASE_TIME);
  await page.reload();
  const card = page.getByTestId('reason-card');
  await expect(card.getByTestId('reason-question')).toHaveText('10/15(木) 英単語 は記録なし。何があった?');
  const t = tapper();
  await t.tap(card.getByRole('radio', { name: '疲れ' }));
  expect(t.count).toBe(1);
  await expect(card.getByTestId('reason-question')).toHaveText('10/16(金) 英単語 は記録なし。何があった?');

  // 記録したものは再読み込みしても戻らない
  await page.reload();
  await expect(page.getByTestId('reason-question')).toHaveText('10/16(金) 英単語 は記録なし。何があった?');
});
