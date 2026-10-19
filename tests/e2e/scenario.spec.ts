import { expect, test, type Page } from '@playwright/test';
import { createHabit, onboardToHabit } from './helpers';

/** アプリの origin 以外へのリクエストを集める */
function watchExternal(page: Page, baseURL: string): string[] {
  const origin = new URL(baseURL).origin;
  const external: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (new URL(url).origin !== origin) external.push(url);
  });
  return external;
}

async function openQuick(page: Page) {
  await page.getByTestId('bottom-nav').getByRole('button', { name: '追加' }).click();
  await expect(page.getByTestId('quick-sheet')).toBeVisible();
}

// §13 T32 の全体シナリオ。悪手を記録する手を、その週のふりかえりに入れるため月曜に始める
test('AC-UX-07: 全体シナリオ（オンボーディング → 習慣 → 10分だけ → 手番 → 段 → 判定 → 刻む → 週次ふりかえり → 数字）の間、外部へのリクエストが0件', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const external = watchExternal(page, baseURL ?? 'http://localhost:4319/itte/');
  await page.clock.install({ time: new Date('2026-10-19T09:00:00+09:00') });

  // オンボーディング（診断スキップ）→ 習慣を作る → ホームで「やった」
  await onboardToHabit(page);
  await createHabit(page, '英単語');
  await page.getByRole('button', { name: '英単語をやったと記録する' }).click();
  await expect(page.getByText('記録済み 10分')).toBeVisible();

  // ＋「10分だけ」でラフ登録して開始 → 詰まり（fill）→ 時計を進めて終了 →「やめる」と次の一手
  await openQuick(page);
  await page.getByTestId('quick-tenMin').click();
  await page.getByLabel('やること', { exact: true }).fill('卒論の序章');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('雑な版', { exact: true }).fill('見出しだけ');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('最初の動作', { exact: true }).fill('エディタを開く');
  await page.getByRole('button', { name: '保存して始める' }).click();
  await expect(page).toHaveURL(/#\/session\/[0-9a-f-]+$/);
  await page.getByRole('button', { name: '詰まった' }).click();
  await page.getByLabel('分からないこと', { exact: true }).fill('章の順番');
  await page.getByRole('button', { name: '雑に埋めて進む' }).click();
  await expect(page.getByTestId('stuck-sheet')).toHaveCount(0);
  await page.clock.runFor(10 * 60_000 + 1_000);
  await expect(page).toHaveURL(/#\/session\/[0-9a-f-]+\/end$/);
  await page.getByRole('button', { name: 'やめる' }).click();
  await page.getByLabel('次の一手', { exact: true }).fill('2章の見出しを書く');
  await page.getByRole('button', { name: '確定する' }).click();
  await expect(page).toHaveURL(/#\/$/);

  // ＋「手番」で読みシート → 決める
  await openQuick(page);
  await page.getByTestId('quick-turn').click();
  await expect(page).toHaveURL(/#\/moves\/new$/);
  await page.getByLabel('どんな局面?', { exact: true }).fill('飲み会の誘いへの返事');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('候補 1', { exact: true }).fill('行く');
  await page.getByLabel('候補 2', { exact: true }).fill('断る');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('radio', { name: '行く' }).click();
  await page.getByRole('button', { name: 'これにする' }).click();
  await expect(page).toHaveURL(/#\/$/);

  // 明日を期限に段を立てる
  await openQuick(page);
  await page.getByTestId('quick-create').click();
  await page.getByRole('button', { name: '段を立てる' }).click();
  await expect(page).toHaveURL(/#\/goals\/new$/);
  await page.getByRole('radio', { name: '新しい指標' }).click();
  await page.getByLabel('指標の名前', { exact: true }).fill('覚えた単語');
  await page.getByLabel('単位', { exact: true }).fill('語');
  await page.getByRole('radio', { name: '多いほど良い' }).click();
  await page.getByLabel('取得方法', { exact: true }).fill('単語帳の数');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('段の名前', { exact: true }).fill('30語');
  await page.getByLabel('閾値', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.locator('input[type="date"]').fill('2026-10-20');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByLabel('届いたら、次に何をする?', { exact: true }).fill('50語の段を立てる');
  await page.getByLabel('届かなかったら、次に何をする?', { exact: true }).fill('1日5語に刻む');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('radio', { name: '50%' }).click();
  await page.getByLabel('予想する値', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'つぎへ' }).click();
  await page.getByRole('button', { name: 'この段を立てる' }).click();
  await expect(page).toHaveURL(/#\/goals\/[0-9a-f-]+$/);

  // 時計を2日進める → 判定（届かなかった）→ 刻む
  await page.clock.setSystemTime(new Date('2026-10-21T09:00:00+09:00'));
  await page.goto('./#/');
  await page.reload();
  const judgeNode = page.locator('[data-testid^="judge-node-"]');
  await judgeNode.getByRole('button', { name: '判定する' }).click();
  await expect(page).toHaveURL(/#\/judge\/[0-9a-f-]+$/);
  await page.getByLabel('実測は?', { exact: true }).fill('18');
  await page.getByRole('button', { name: '確かめる' }).click();
  await expect(page.getByTestId('check-sheet')).toContainText('届かなかった');
  await page.getByTestId('check-sheet').getByRole('button', { name: '確定する' }).click();
  await page.getByLabel('かけた時間は?（時間）', { exact: true }).fill('3');
  await page.getByLabel('失ったものは?', { exact: true }).fill('夜の自由な時間');
  await page.getByRole('button', { name: '確定する' }).click();
  await page.getByRole('button', { name: '刻む' }).click();
  await expect(page).toHaveURL(/#\/goals\/[0-9a-f-]+\/kizami$/);

  // 時計を金曜に進める → 週次ふりかえりで、その手を悪手（読み違い）として記録
  await page.clock.setSystemTime(new Date('2026-10-23T20:00:00+09:00'));
  await page.goto('./#/');
  await page.reload();
  await page.getByTestId('weekly-node').getByRole('button', { name: '始める' }).click();
  await expect(page).toHaveURL(/#\/review\/weekly\/2026-10-19$/);
  await page.getByTestId('lesson-shell').getByRole('button', { name: 'つぎへ' }).click();
  await expect(page.getByTestId('review-move')).toContainText('行く（選んだ手）');
  await page.getByRole('radiogroup', { name: '当時の情報で、判断は妥当だった?' }).getByRole('radio', { name: 'いいえ' }).click();
  await page.getByRole('radio', { name: '悪手' }).click();
  await page.getByRole('radio', { name: '読み違い' }).click();
  await page.getByTestId('lesson-shell').getByRole('button', { name: '保存' }).click();
  await expect(page.getByTestId('review-move')).toHaveCount(0);

  // 数字の画面で悪手1件が反映される
  await page.goto('./#/review/numbers');
  await expect(page.getByTestId('numbers-week')).toContainText('10/19');
  await expect(page.getByTestId('numbers')).toContainText(/読み違い\s*1件/);

  expect(external).toEqual([]);
});
