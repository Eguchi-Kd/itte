import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { habitDraft, testDb as db } from '../../db/__tests__/helpers';
import { exportJson } from '../../db/repo/common';
import { recordDone, saveHabit } from '../../db/repo/habits';
import { NOW, renderAt, resetDb } from './testUtils';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
  // jsdom には URL.createObjectURL がないので、ダウンロードは呼ばれたことだけを確かめる
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:x'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('全データ削除', () => {
  it('AC-DATA-06: 全削除は2段階の確認（2段目で「削除」と入力）を経ないと実行されない', async () => {
    await saveHabit(habitDraft(), NOW);
    renderAt('/settings/data');
    fireEvent.click(await screen.findByRole('button', { name: ja.settings.wipe }));
    const sheet = screen.getByTestId('wipe-confirm');
    expect(sheet).toHaveTextContent(ja.settings.wipeIntro);
    expect(within(sheet).queryByRole('button', { name: ja.settings.wipeExecute })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: ja.settings.wipeNext }));
    const execute = within(screen.getByTestId('wipe-confirm')).getByRole('button', { name: ja.settings.wipeExecute });
    expect(execute).toBeDisabled();
    fireEvent.change(screen.getByTestId('wipe-word'), { target: { value: 'さくじょ' } });
    expect(execute).toBeDisabled();
    fireEvent.click(execute);
    expect(await db.habits.count()).toBe(1);
    // やめると最初からやり直し
    fireEvent.click(within(screen.getByTestId('wipe-confirm')).getByRole('button', { name: ja.common.cancel }));
    expect(screen.queryByTestId('wipe-confirm')).toBeNull();
    expect(await db.habits.count()).toBe(1);
  });

  it('AC-CORE-08: 全データ削除の後、データは空になり、アプリはオンボーディングから始まる', async () => {
    const h = await saveHabit(habitDraft(), NOW);
    await recordDone(h.id, '2026-10-18', undefined, NOW);
    const { router } = renderAt('/settings/data');
    fireEvent.click(await screen.findByRole('button', { name: ja.settings.wipe }));
    fireEvent.click(screen.getByRole('button', { name: ja.settings.wipeNext }));
    fireEvent.change(screen.getByTestId('wipe-word'), { target: { value: '削除' } });
    fireEvent.click(screen.getByRole('button', { name: ja.settings.wipeExecute }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
    expect(await screen.findByRole('button', { name: ja.onboarding.start })).toBeInTheDocument();
    expect(await db.habits.count()).toBe(0);
    expect(await db.habitLogs.count()).toBe(0);
    expect(await db.ledger.count()).toBe(0);
    expect((await db.settings.get('singleton'))?.onboarded).toBe(false);
    // ほかのルートを開いてもオンボーディングへ
    await router.navigate('/library');
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
  });
});

describe('整合性', () => {
  it('AC-DATA-08: 設定画面の整合性の確認が「問題ありません（{n}件）」を表示する', async () => {
    renderAt('/settings/data');
    fireEvent.click(await screen.findByRole('button', { name: ja.settings.integrityCheck }));
    expect(await screen.findByTestId('integrity-result')).toHaveTextContent('問題ありません（0件）');
  });
});

describe('バックアップ', () => {
  it('AC-DATA-07: 記録があり一度も書き出していなければホームにバックアップのカードを出し、書き出すと消える', async () => {
    await saveHabit(habitDraft(), NOW);
    renderAt('/');
    const card = await screen.findByTestId('backup-card');
    expect(card).toHaveTextContent(ja.today.interrupt.backup);
    await exportJson(NOW);
    await waitFor(() => expect(screen.queryByTestId('backup-card')).toBeNull());
  });

  it('JSON の書き出しでファイルを保存させ、lastExportAt を入れる', async () => {
    renderAt('/settings/data');
    fireEvent.click(await screen.findByRole('button', { name: ja.settings.exportJson }));
    await waitFor(async () => expect((await db.settings.get('singleton'))?.lastExportAt).toBe(NOW));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('読み込み', () => {
  it('検証して件数を出し、「現在のデータをすべて置き換えます」で確定すると置き換わる', async () => {
    await saveHabit(habitDraft({ name: '書き出した習慣' }), NOW);
    const { text } = await exportJson(NOW);
    await saveHabit(habitDraft({ name: 'あとから足した習慣' }), NOW);
    renderAt('/settings/data');
    const input = await screen.findByTestId('import-json');
    fireEvent.change(input, { target: { files: [new File([text], 'b.json', { type: 'application/json' })] } });
    const sheet = await screen.findByTestId('check-sheet');
    expect(sheet).toHaveAccessibleName(ja.settings.importReplace);
    expect(sheet).toHaveTextContent(/件のデータを読み込みます/);
    fireEvent.click(within(sheet).getByRole('button', { name: ja.settings.importJson }));
    await waitFor(async () => expect((await db.habits.toArray()).map((h) => h.name)).toEqual(['書き出した習慣']));
  });

  it('形式の正しくないファイルは読み込まず、理由を出す', async () => {
    await saveHabit(habitDraft(), NOW);
    renderAt('/settings/data');
    fireEvent.change(await screen.findByTestId('import-json'), { target: { files: [new File(['{"app":"x"}'], 'x.json')] } });
    expect(await screen.findByTestId('data-message')).toHaveTextContent(ja.errors.importInvalid);
    expect(await db.habits.count()).toBe(1);
  });
});

describe('設定', () => {
  it('音と振動を切り替え、理由タグを足して非表示にできる', async () => {
    renderAt('/settings');
    fireEvent.click(await screen.findByRole('switch', { name: ja.settings.sound }));
    await waitFor(async () => expect((await db.settings.get('singleton'))?.soundOn).toBe(false));
    fireEvent.change(screen.getByLabelText(ja.settings.tagAdd), { target: { value: '雨' } });
    fireEvent.click(screen.getByRole('button', { name: ja.settings.tagAdd }));
    await waitFor(async () => expect((await db.reasonTags.toArray()).some((t) => t.label === '雨')).toBe(true));
    const tag = (await db.reasonTags.toArray()).find((t) => t.label === '雨');
    fireEvent.click(within(await screen.findByTestId(`tag-${tag?.id}`)).getByRole('button', { name: ja.settings.tagHide }));
    await waitFor(async () => expect((await db.reasonTags.get(tag?.id ?? ''))?.archived).toBe(true));
  });
});
