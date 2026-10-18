import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ja } from '../../copy/ja';
import { testDb as db } from '../../db/__tests__/helpers';
import type { Persona } from '../../domain/types';
import { renderAt, resetDb } from './testUtils';

const next = () => screen.getByRole('button', { name: ja.common.next });

function typeInto(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function start(persona: Persona | null, kind: 'build' | 'replace' = 'build') {
  await resetDb({ onboarded: true, persona });
  renderAt('/habits/new');
  fireEvent.click(await screen.findByRole('radio', { name: kind === 'build' ? ja.habits.build : ja.habits.replace }));
}

/** ステップ2を有効な値で埋める */
function fillWhat(p: { amount?: string; min?: string; purpose?: string } = {}) {
  typeInto(ja.habits.field.name, '英単語');
  if (p.purpose !== undefined) typeInto(ja.habits.field.purpose, p.purpose);
  fireEvent.click(screen.getByRole('radio', { name: '分' }));
  typeInto(ja.habits.field.amount, p.amount ?? '10');
  typeInto(ja.habits.field.minAmount, p.min ?? '5');
}

function fillWhen(p: { time?: string; cue?: string } = {}) {
  if (p.time !== undefined) typeInto(ja.habits.field.time, p.time);
  if (p.cue !== undefined) typeInto(ja.habits.field.cue, p.cue);
  typeInto(ja.habits.field.place, '机');
}

beforeEach(async () => {
  await resetDb({ onboarded: true });
});

describe('習慣作成ウィザード', () => {
  it('AC-HAB-08: 絶対にできる量 > 量 では次へ進めない', async () => {
    await start(null);
    fireEvent.click(next());
    fillWhat({ amount: '5', min: '6' });
    expect(next()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(ja.errors.minAmountRange);
    typeInto(ja.habits.field.minAmount, '5');
    expect(next()).toBeEnabled();
  });

  it('AC-HAB-08: 時刻ときっかけの両方が空では次へ進めない', async () => {
    await start(null);
    fireEvent.click(next());
    fillWhat();
    fireEvent.click(next());
    expect(await screen.findByRole('heading', { name: ja.habits.whenQ })).toBeInTheDocument();
    fillWhen();
    expect(next()).toBeDisabled();
    typeInto(ja.habits.field.cue, '朝食のあと');
    expect(next()).toBeEnabled();
    typeInto(ja.habits.field.cue, '');
    typeInto(ja.habits.field.time, '07:00');
    expect(next()).toBeEnabled();
  });

  it('AC-HAB-08: regret で環境設計メモが空では次へ進めない', async () => {
    await start('regret');
    fireEvent.click(next());
    fillWhat();
    fireEvent.click(next());
    fillWhen({ time: '07:00' });
    expect(next()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(ja.habits.field.commitmentNote), { target: { value: '前の晩に本を出す' } });
    expect(next()).toBeEnabled();
  });

  it('AC-HAB-08: meaning で目的が空では次へ進めない', async () => {
    await start('meaning');
    fireEvent.click(next());
    fillWhat();
    expect(next()).toBeDisabled();
    typeInto(ja.habits.field.purpose, '英語の論文を読めるようになる');
    expect(next()).toBeEnabled();
  });

  it('AC-HAB-08: 既定のペルソナでは目的と環境設計メモが空でも進める', async () => {
    await start(null);
    fireEvent.click(next());
    fillWhat();
    expect(next()).toBeEnabled();
    fireEvent.click(next());
    fillWhen({ time: '07:00' });
    expect(next()).toBeEnabled();
  });

  it('やめたい を選ぶと、やめたいことを入れるまで進めず、見出しが「代わりに何をする?」になる', async () => {
    await start(null, 'replace');
    expect(next()).toBeDisabled();
    typeInto(ja.habits.field.replacesText, 'スマホを見る');
    fireEvent.click(next());
    expect(await screen.findByRole('heading', { name: ja.habits.replaceQ })).toBeInTheDocument();
  });

  it('小さく始めるガード: 量が絶対にできる量の2倍を超えると提案を出し、「そうする」で量を置き換える（selfblame は1.5倍）', async () => {
    await start(null);
    fireEvent.click(next());
    fillWhat({ amount: '10', min: '5' });
    expect(screen.queryByTestId('small-start')).toBeNull();
    typeInto(ja.habits.field.amount, '11');
    expect(screen.getByTestId('small-start')).toHaveTextContent('最初は 5分 から始めてみませんか');
    fireEvent.click(screen.getByRole('radio', { name: ja.habits.smallStartAccept }));
    expect(screen.getByLabelText(ja.habits.field.amount)).toHaveValue('5');

    cleanup();
    await start('selfblame');
    fireEvent.click(next());
    fillWhat({ amount: '8', min: '5' });
    expect(screen.getByTestId('small-start')).toBeInTheDocument();
  });

  it('notfun では「楽しくする工夫」の欄が出る', async () => {
    await start('notfun');
    fireEvent.click(next());
    fillWhat();
    fireEvent.click(next());
    expect(screen.getByTestId('habit-fun')).toBeInTheDocument();
  });

  it('確認で実行意図の1文を出し、「この内容で始める」で保存してホームに戻る', async () => {
    await start(null);
    fireEvent.click(next());
    fillWhat();
    fireEvent.click(next());
    fireEvent.click(screen.getByRole('checkbox', { name: ja.habits.dayPresets.weekdays }));
    fillWhen({ time: '07:00' });
    fireEvent.click(next());
    expect(await screen.findByTestId('intention')).toHaveTextContent('平日の7:00に、机で、英単語を10分');
    fireEvent.click(screen.getByRole('button', { name: ja.habits.startWith }));
    await waitFor(async () => expect(await db.habits.count()).toBe(1));
    const h = (await db.habits.toArray())[0];
    expect(h).toMatchObject({ name: '英単語', unit: '分', amount: 10, minAmount: 5, schedule: { days: [1, 2, 3, 4, 5] } });
    expect(await screen.findByTestId('feedback-sheet')).toHaveTextContent(ja.feedback.recorded);
  });
});
