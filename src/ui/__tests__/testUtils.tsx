import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../routes';
import { NOW, resetSeeded } from '../../db/__tests__/helpers';
import { UpdateContext, type UpdateState } from '../hooks/updateContext';

export { NOW };
export const resetDb = resetSeeded;

export function renderAt(path: string, update: UpdateState = { needRefresh: false, update: () => undefined }) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <UpdateContext.Provider value={update}>
      <RouterProvider router={router} />
    </UpdateContext.Provider>,
  );
  return { ...utils, router };
}
