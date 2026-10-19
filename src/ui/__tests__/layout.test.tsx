import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { ja } from '../../copy/ja';
import { Koma } from '../mascot/Koma';
import { allowsInterruptions, routeKind, showsBottomNav } from '../routePolicy';
import { habitDraft } from '../../db/__tests__/helpers';
import { saveHabit } from '../../db/repo/habits';
import { NOW, renderAt, resetDb } from './testUtils';

const NO_TAB_PATHS = {
  lesson: ['/onboarding', '/session/s1/end', '/daily', '/moves/new', '/goals/new', '/goals/g1/kizami', '/judge/g1', '/review/weekly/2026-10-12'],
  timer: ['/session/s1'],
  wizard: ['/habits/new', '/tasks/new'],
};

beforeEach(async () => {
  await resetDb({ onboarded: true });
  // 記録があり一度も書き出していないので、タブの画面ならバックアップの割り込みが出る条件
  await saveHabit(habitDraft(), NOW);
});

describe('下部タブと割り込み', () => {
  for (const [kind, paths] of Object.entries(NO_TAB_PATHS)) {
    for (const path of paths) {
      it(`AC-UX-09: ${kind} の ${path} で下部タブが表示されず、更新・バックアップの割り込みが出ない`, async () => {
        expect(routeKind(path)).toBe(kind);
        const { container } = renderAt(path, { needRefresh: true, update: () => undefined });
        await waitFor(() => expect(container.querySelector('main')).not.toBeNull());
        expect(screen.queryByTestId('bottom-nav')).toBeNull();
        expect(screen.queryByText(ja.today.interrupt.update)).toBeNull();
        expect(screen.queryByText(ja.today.interrupt.backup)).toBeNull();
        expect(showsBottomNav(path)).toBe(false);
        expect(allowsInterruptions(path)).toBe(false);
      });
    }
  }

  it('AC-UX-09: タブ画面では下部タブと更新のスナックバーが出て、ホームにはバックアップの割り込みが出る（対照）', async () => {
    renderAt('/library', { needRefresh: true, update: () => undefined });
    expect(await screen.findByTestId('bottom-nav')).toBeInTheDocument();
    expect(screen.getByText(ja.today.interrupt.update)).toBeInTheDocument();
    cleanup();
    renderAt('/', { needRefresh: true, update: () => undefined });
    expect(await screen.findByTestId('backup-card')).toHaveTextContent(ja.today.interrupt.backup);
    expect(screen.getByText(ja.today.interrupt.update)).toBeInTheDocument();
  });

  it('記録庫の一覧では下部タブを出し、更新のスナックバーは出さない', async () => {
    renderAt('/library/habits', { needRefresh: true, update: () => undefined });
    expect(await screen.findByTestId('bottom-nav')).toBeInTheDocument();
    expect(screen.queryByText(ja.today.interrupt.update)).toBeNull();
  });
});

describe('コマ', () => {
  for (const path of ['/judge/g1', '/session/s1', '/escape/new']) {
    it(`AC-UX-12: ${path}（判定・タイマーと詰まりシート・逃避ログ）ではコマが描画されない`, () => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <Koma pose="sit" />
          <Koma pose="point" says={ja.koma.emptyHome} />
        </MemoryRouter>,
      );
      expect(screen.queryByTestId('koma')).toBeNull();
      expect(screen.queryByRole('img', { name: ja.koma.label })).toBeNull();
    });
  }

  it('AC-UX-12: オンボーディングと空の状態ではコマが描画される（対照）', () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Koma pose="wave" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('img', { name: ja.koma.label })).toBeInTheDocument();
  });

  it('コマはポーズが変わっても目は2つのまま（表情は1種類）', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Koma pose="wave" />
        <Koma pose="point" />
        <Koma pose="read" />
        <Koma pose="sit" />
      </MemoryRouter>,
    );
    const figures = container.querySelectorAll('[data-testid="koma"]');
    expect(figures).toHaveLength(4);
    figures.forEach((f) => expect(f.querySelectorAll('circle')).toHaveLength(2));
  });
});
