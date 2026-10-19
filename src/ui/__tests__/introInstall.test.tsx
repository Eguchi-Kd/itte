import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from '../../copy/ja';
import { fill } from '../../copy/fill';
import { habitDraft, testDb as db } from '../../db/__tests__/helpers';
import { recordDone, saveHabit } from '../../db/repo/habits';
import type { InstallState } from '../hooks/installContext';
import { NOW, renderAt, resetDb } from './testUtils';

const noUpdate = { needRefresh: false, update: () => undefined };
const noLaunch = { escapeSessionId: null, clearEscape: () => undefined };

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await resetDb({ onboarded: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('「はじめての○○」カード', () => {
  it('レッスンを初めて開いたときだけ1枚出し、introSeen に残す。2回目は出さない', async () => {
    renderAt('/habits/new');
    const card = await screen.findByTestId('intro-habit');
    expect(card).toHaveTextContent(fill(ja.intro.label, { name: ja.intro.habit.name }));
    expect(card).toHaveTextContent(ja.intro.habit.body);
    await waitFor(async () => expect((await db.settings.get('singleton'))?.introSeen).toEqual(['habit']));
    fireEvent.click(within(card).getByRole('button', { name: ja.intro.ok }));
    expect(screen.queryByTestId('intro-habit')).toBeNull();
    cleanup();

    renderAt('/habits/new');
    await screen.findByTestId('lesson-shell');
    expect(screen.queryByTestId('intro-habit')).toBeNull();
  });

  it('レッスンごとに別々に数える', async () => {
    await db.settings.update('singleton', { introSeen: ['habit'] });
    renderAt('/tasks/new');
    expect(await screen.findByTestId('intro-task')).toHaveTextContent(ja.intro.task.body);
  });
});

describe('ホーム画面に追加のカード（割り込み6）', () => {
  const prompt = vi.fn(async () => undefined);
  const android: InstallState = { installed: false, method: 'prompt', prompt };

  it('最初の記録の後、未インストールなら出し、ボタンで追加のダイアログを出す。そのあとは出さない', async () => {
    const h = await saveHabit(habitDraft(), NOW);
    await recordDone(h.id, '2026-10-18', undefined, NOW);
    renderAt('/', noUpdate, noLaunch, android);
    const card = await screen.findByTestId('install-card');
    expect(card).toHaveTextContent(ja.today.interrupt.install);
    fireEvent.click(within(card).getByRole('button', { name: ja.today.interrupt.installAction }));
    await waitFor(() => expect(prompt).toHaveBeenCalled());
    await waitFor(async () => expect((await db.settings.get('singleton'))?.installPromptShown).toBe(true));
    await waitFor(() => expect(screen.queryByTestId('install-card')).toBeNull());
  });

  it('iOS では共有メニューの手順を出し、「あとで」を押すともう出さない', async () => {
    const h = await saveHabit(habitDraft(), NOW);
    await recordDone(h.id, '2026-10-18', undefined, NOW);
    renderAt('/', noUpdate, noLaunch, { installed: false, method: 'ios', prompt });
    const card = await screen.findByTestId('install-card');
    expect(card).toHaveTextContent(ja.today.interrupt.installIos);
    fireEvent.click(within(card).getByRole('button', { name: ja.common.later }));
    await waitFor(() => expect(screen.queryByTestId('install-card')).toBeNull());
    expect((await db.settings.get('singleton'))?.installPromptShown).toBe(true);
  });

  it('記録がない、インストール済み、追加の手段がないときは出さない', async () => {
    await saveHabit(habitDraft(), NOW);
    renderAt('/', noUpdate, noLaunch, android);
    await screen.findByTestId('home');
    expect(screen.queryByTestId('install-card')).toBeNull();
    cleanup();

    const h = (await db.habits.toArray())[0];
    if (h) await recordDone(h.id, '2026-10-18', undefined, NOW);
    renderAt('/', noUpdate, noLaunch, { installed: true, method: 'prompt', prompt });
    await screen.findByTestId('home');
    expect(screen.queryByTestId('install-card')).toBeNull();
    cleanup();

    renderAt('/', noUpdate, noLaunch, { installed: false, method: null, prompt });
    await screen.findByTestId('home');
    expect(screen.queryByTestId('install-card')).toBeNull();
  });
});
