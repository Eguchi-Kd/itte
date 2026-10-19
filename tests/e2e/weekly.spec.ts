import { expect, test } from '@playwright/test';
import { createHabit, onboardToHabit } from './helpers';

test('AC-REV-03: 週次ふりかえりのカードは1枚ごとに保存され、途中で閉じて開き直すと続きのカードから始まる', async ({ page }) => {
  // 日曜（論理日）なので、その週のふりかえりがホームの道に出る
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00+09:00'));
  await onboardToHabit(page);
  await createHabit(page, '英単語');

  const node = page.getByTestId('weekly-node');
  await expect(node).toBeVisible();
  await node.getByRole('button', { name: '始める' }).click();
  await expect(page).toHaveURL(/#\/review\/weekly\/2026-10-12$/);
  await expect(page.getByTestId('weekly-facts')).toContainText('英単語');
  // 習慣を作った直後のフィードバックシートにも「つぎへ」があるので、レッスンの中のボタンを押す
  await page.getByTestId('lesson-shell').getByRole('button', { name: 'つぎへ' }).click();

  // 2枚目（習慣）で閉じて、開き直す
  await expect(page.getByRole('radiogroup', { name: '考えなくても始めている' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  for (const q of ['考えなくても始めている', 'やらないと落ち着かない', '始めるのに意志の力がいらない', '気づいたらやっている']) {
    await page.getByRole('radiogroup', { name: q }).getByRole('radio', { name: '3（5段階）' }).click();
  }
  await page.getByRole('button', { name: '保存' }).click();

  // しめのカードで閉じて開き直しても、しめから始まる
  await expect(page.getByTestId('weekly-close')).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).first().click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('./#/review/weekly/2026-10-12');
  await expect(page.getByTestId('weekly-close')).toBeVisible();
  await page.getByRole('button', { name: '記録する' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('weekly-node')).toHaveAttribute('data-state', 'done');
});
