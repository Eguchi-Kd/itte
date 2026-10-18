import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ja } from '../../copy/ja';
import { getSettings } from '../../db/repo/common';
import { NOW, renderAt, resetDb } from './testUtils';

beforeEach(async () => {
  await resetDb();
});

async function answer(values: number[]) {
  for (const v of values) {
    const group = await screen.findByRole('radiogroup');
    const q = group.getAttribute('aria-label');
    fireEvent.click(screen.getAllByRole('radio')[v - 1]);
    await waitFor(() => expect(screen.queryByRole('radiogroup', { name: q ?? '' })).toBeNull());
  }
}

describe('未オンボーディングのリダイレクト', () => {
  for (const path of ['/', '/library', '/habits/new', '/settings', '/board']) {
    it(`AC-CORE-06: 未オンボーディングで ${path} を開くとオンボーディングに移り、下部タブが表示されない`, async () => {
      const { router } = renderAt(path);
      expect(await screen.findByRole('button', { name: ja.onboarding.start })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/onboarding');
      expect(screen.queryByTestId('bottom-nav')).toBeNull();
    });
  }

  it('AC-CORE-06: オンボーディング後は開いたルートにとどまる', async () => {
    await resetDb({ onboarded: true });
    const { router } = renderAt('/library');
    expect(await screen.findByTestId('bottom-nav')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/library');
  });
});

describe('オンボーディング', () => {
  it('AC-CORE-07: 診断をスキップすると persona=null で、入口を選んだ時点で onboarded=true になる', async () => {
    const { router } = renderAt('/onboarding');
    fireEvent.click(await screen.findByRole('button', { name: ja.onboarding.start }));
    expect(await screen.findByText(ja.onboarding.personaQ.regret)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ja.common.skip }));
    expect(await screen.findByText(ja.onboarding.entryTitle)).toBeInTheDocument();
    expect((await getSettings(NOW)).onboarded).toBe(false);
    fireEvent.click(screen.getByTestId('entry-habit'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/habits/new'));
    const s = await getSettings(NOW);
    expect(s).toMatchObject({ onboarded: true, persona: null, personaScores: null });
  });

  it('AC-CORE-07: 5問に答えると、同点なら表の上にある persona になる（自動で次へ進む）', async () => {
    const { router } = renderAt('/onboarding');
    fireEvent.click(await screen.findByRole('button', { name: ja.onboarding.start }));
    await answer([2, 4, 3, 4, 1]);
    expect(await screen.findByText(ja.onboarding.entryTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ja.onboarding.entryLater }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await getSettings(NOW)).toMatchObject({
      onboarded: true,
      persona: 'optimist',
      personaScores: { regret: 2, optimist: 4, meaning: 3, selfblame: 4, notfun: 1 },
    });
  });

  it('入口の4択はそれぞれのレッスンへ移る', async () => {
    const { router } = renderAt('/onboarding');
    fireEvent.click(await screen.findByRole('button', { name: ja.onboarding.start }));
    fireEvent.click(await screen.findByRole('button', { name: ja.common.skip }));
    fireEvent.click(await screen.findByTestId('entry-start'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/tasks/new'));
    expect(router.state.location.search).toBe('?start=1');
  });
});
