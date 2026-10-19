/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { createHabit, onboardToHabit } from './helpers';

/**
 * 画面に見えているボタンとチップのうち、当たり判定が 48×48px に満たないもの（と名前のないもの）を返す。
 * 当たり判定は中心から上下左右 23px の点を elementFromPoint で確かめる（見た目より広い当たり判定も数える）
 */
async function smallTargets(page: Page): Promise<string[]> {
  // 数秒で消える帯（記録直後のフィードバックとスナックバー）が消えてから、下の画面を測る
  await expect(page.getByTestId('snackbar')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByTestId('feedback-sheet')).toHaveCount(0, { timeout: 10_000 });
  return page.evaluate(async () => {
    // シートが出る動きの途中では測らない
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
    const sel = 'button, [role="radio"], [role="checkbox"], [role="switch"]';
    // モーダルのシートが開いているときは、その中だけを測る（下の画面は押せない）
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
    const root: ParentNode = dialogs.length > 0 ? dialogs[dialogs.length - 1] : document;
    const offenders: string[] = [];
    const targets = Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => {
      if (el.closest('.sr-only')) return false;
      // 閉じた details の中など、描画されていないもの
      if (!el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
    for (const el of targets) {
      // アクセシビリティの点検: 名前のないボタンも数える（アイコンだけのボタンには aria-label が要る）
      const labelledBy = el.getAttribute('aria-labelledby');
      const accName = el.getAttribute('aria-label') ?? (labelledBy ? document.getElementById(labelledBy)?.textContent : null) ?? el.textContent;
      if (!accName?.trim()) offenders.push(`名前のない ${el.tagName.toLowerCase()}`);
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hits = (x: number, y: number) => {
        const hit = document.elementFromPoint(x, y);
        if (!hit) return false;
        if (el.contains(hit)) return true;
        // 行全体が label のトグル（行のどこを押しても切り替わる）
        const label = hit.closest('label');
        return label !== null && label.contains(el);
      };
      const points: [number, number][] = [
        [cx, cy - 23],
        [cx, cy + 23],
        [cx - 23, cy],
        [cx + 23, cy],
      ];
      const miss = points.find(([x, y]) => !hits(x, y));
      if (miss) {
        const hit = document.elementFromPoint(miss[0], miss[1]);
        const name = el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName;
        const by = hit ? `${hit.tagName.toLowerCase()}[${hit.textContent?.trim().slice(0, 20)}]` : 'none';
        offenders.push(`${name} (${Math.round(r.width)}x${Math.round(r.height)}) covered by ${by}`);
      }
    }
    window.scrollTo(0, 0);
    return offenders;
  });
}

test.describe('当たり判定', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T09:00:00+09:00'));
  });

  test('AC-UX-08: ホーム、習慣作成、タイマー、読みシート、判定の各画面で、ボタンとチップの当たり判定が 48×48px 以上', async ({ page }) => {
    test.setTimeout(90_000);
    await onboardToHabit(page);
    // 習慣作成の各ステップ
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('radio', { name: '始めたい' }).click();
    await page.getByRole('button', { name: 'つぎへ' }).click();
    expect(await smallTargets(page)).toEqual([]);
    // 同じルートなのでハッシュだけでは入力が残る。読み込み直して最初のステップから作る
    await page.reload();
    await createHabit(page, '英単語');

    // ホーム（習慣のノード、記録済みの表示）
    await expect(page.getByTestId('home')).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: '英単語をやったと記録する' }).click();
    expect(await smallTargets(page)).toEqual([]);

    // タイマーと詰まりシート
    await page.goto('./#/tasks/new');
    await page.getByLabel('やること', { exact: true }).fill('卒論の序章');
    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.getByLabel('雑な版', { exact: true }).fill('見出しだけ');
    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.getByLabel('最初の動作', { exact: true }).fill('エディタを開く');
    await page.getByRole('button', { name: '保存して始める' }).click();
    await expect(page.getByTestId('session-timer')).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: '詰まった' }).click();
    await expect(page.getByTestId('stuck-sheet')).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    await page.getByLabel('分からないこと', { exact: true }).fill('章の順番');
    await page.getByRole('button', { name: '雑に埋めて進む' }).click();
    await page.getByRole('button', { name: '中断' }).click();
    await expect(page).toHaveURL(/#\/session\/[0-9a-f-]+\/end$/);

    // 読みシートの各ステップ
    await page.goto('./#/moves/new');
    await page.getByLabel('どんな局面?', { exact: true }).fill('飲み会の誘いへの返事');
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.getByLabel('候補 1', { exact: true }).fill('行く');
    await page.getByLabel('候補 2', { exact: true }).fill('断る');
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: 'つぎへ' }).click();
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: 'つぎへ' }).click();
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('radio', { name: '行く' }).click();
    await page.getByRole('button', { name: 'これにする' }).click();
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.getByTestId('feedback-sheet')).toHaveCount(0);

    // 判定（期限を明日にした段を、2日後に判定する）
    await page.goto('./#/goals/new');
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
    await page.clock.setFixedTime(new Date('2026-10-21T09:00:00+09:00'));
    await page.goto('./#/');
    await page.reload();
    await page.locator('[data-testid^="judge-node-"]').getByRole('button', { name: '判定する' }).click();
    await expect(page).toHaveURL(/#\/judge\/[0-9a-f-]+$/);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByLabel('実測は?', { exact: true }).fill('18');
    await page.getByRole('button', { name: '確かめる' }).click();
    expect(await smallTargets(page)).toEqual([]);
    await page.getByTestId('check-sheet').getByRole('button', { name: '確定する' }).click();
    await page.getByLabel('かけた時間は?（時間）', { exact: true }).fill('3');
    await page.getByLabel('失ったものは?', { exact: true }).fill('夜の自由な時間');
    await page.getByRole('button', { name: '確定する' }).click();
    await expect(page.getByRole('button', { name: '刻む' })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
  });
});

test.describe('動きの抑制', () => {
  test.use({ reducedMotion: 'reduce' });

  test('AC-UX-10: reducedMotion=reduce で、ボトムシートと画面遷移に transform のアニメーションがない', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T09:00:00+09:00'));
    const transformAnimations = () =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => {
            const effect = a.effect as KeyframeEffect | null;
            return effect?.getKeyframes().some((k) => 'transform' in k || 'translate' in k) ?? false;
          })
          .map((a) => (a as CSSAnimation).animationName ?? 'transition'),
      );
    await onboardToHabit(page);
    expect(await transformAnimations()).toEqual([]);
    await createHabit(page, '英単語');
    expect(await transformAnimations()).toEqual([]);
    // ボトムシート（＋）
    await page.getByTestId('bottom-nav').getByRole('button', { name: '追加' }).click();
    await expect(page.getByTestId('quick-sheet')).toBeVisible();
    expect(await transformAnimations()).toEqual([]);
    // 画面遷移
    await page.getByTestId('quick-turn').click();
    await expect(page).toHaveURL(/#\/moves\/new$/);
    expect(await transformAnimations()).toEqual([]);
    await page.goto('./#/board');
    expect(await transformAnimations()).toEqual([]);
  });
});

test.describe('オフライン', () => {
  test.use({ serviceWorkers: 'allow' });

  test('AC-UX-11: Service Worker の登録後にオフラインにしても、すべてのタブ画面とレッスンが表示・操作できる', async ({ page, context }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // SW が制御するように読み込み直す
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: 'はじめる' }).click();
    await page.getByRole('button', { name: 'とばす' }).click();
    await page.getByTestId('entry-habit').click();
    await createHabit(page, '英単語');
    await page.getByRole('button', { name: '英単語をやったと記録する' }).click();
    await expect(page.getByText('記録済み 10分')).toBeVisible();

    for (const [hash, testId] of [
      ['#/board', 'board'],
      ['#/review', 'review-tab'],
      ['#/library', 'library'],
      ['#/', 'home'],
    ] as const) {
      await page.goto(`./${hash}`);
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    for (const hash of ['#/habits/new', '#/tasks/new', '#/moves/new', '#/goals/new', '#/daily']) {
      await page.goto(`./${hash}`);
      await expect(page.getByTestId('lesson-shell')).toBeVisible();
    }
    // レッスンを最後まで操作できる（ラフ登録で保存）
    await page.goto('./#/tasks/new');
    await page.getByLabel('やること', { exact: true }).fill('卒論の序章');
    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.getByLabel('雑な版', { exact: true }).fill('見出しだけ');
    await page.getByRole('button', { name: 'つぎへ' }).click();
    await page.getByLabel('最初の動作', { exact: true }).fill('エディタを開く');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('button', { name: '卒論の序章を始める' })).toBeVisible();
  });
});

test('AC-UX-13: オンボーディング開始から最初の習慣の記録までが、診断をスキップした場合に15タップ以内', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T09:00:00+09:00'));
  let taps = 0;
  const tap = async (action: Promise<void>) => {
    taps += 1;
    await action;
  };
  // 文字の入力欄は、入力のために1回押すものとして数える
  const type = async (label: string, value: string) => {
    taps += 1;
    await page.getByLabel(label, { exact: true }).fill(value);
  };
  await page.goto('./');
  await tap(page.getByRole('button', { name: 'はじめる' }).click());
  await tap(page.getByRole('button', { name: 'とばす' }).click());
  await tap(page.getByTestId('entry-habit').click());
  await tap(page.getByRole('radio', { name: '始めたい' }).click());
  await tap(page.getByRole('button', { name: 'つぎへ' }).click());
  await type('行動名', '英単語');
  await tap(page.getByRole('radio', { name: '分', exact: true }).click());
  await type('1回の量', '10');
  await type('絶対にできる量', '5');
  await tap(page.getByRole('button', { name: 'つぎへ' }).click());
  await type('時刻', '07:00');
  await type('場所', '机');
  await tap(page.getByRole('button', { name: 'つぎへ' }).click());
  await tap(page.getByRole('button', { name: 'この内容で始める' }).click());
  await expect(page).toHaveURL(/#\/$/);
  await tap(page.getByRole('button', { name: '英単語をやったと記録する' }).click());
  await expect(page.getByText('記録済み 10分')).toBeVisible();
  expect(taps).toBeLessThanOrEqual(15);
});
