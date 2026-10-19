import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../routes';
import { NOW, resetSeeded } from '../../db/__tests__/helpers';
import { LaunchContext, type LaunchState } from '../hooks/launchContext';
import { UpdateContext, type UpdateState } from '../hooks/updateContext';

export { NOW };
export const resetDb = resetSeeded;

export function renderAt(
  path: string,
  update: UpdateState = { needRefresh: false, update: () => undefined },
  launch: LaunchState = { escapeSessionId: null, clearEscape: () => undefined },
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <UpdateContext.Provider value={update}>
      <LaunchContext.Provider value={launch}>
        <RouterProvider router={router} />
      </LaunchContext.Provider>
    </UpdateContext.Provider>,
  );
  return { ...utils, router };
}
