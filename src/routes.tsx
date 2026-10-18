import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { AppLayout } from './ui/screens/AppLayout';

// 画面はルートごとに遅延読み込みする（§6.1.2）。T13 以降のモジュールはまだ空の画面
const Placeholder = lazy(() => import('./ui/screens/Placeholder'));

const placeholderPaths = [
  '/',
  '/onboarding',
  '/habits/new',
  '/habits/:id',
  '/habits/:id/edit',
  '/tasks/new',
  '/tasks/:id',
  '/session/:id',
  '/session/:id/end',
  '/escape/new',
  '/daily',
  '/board',
  '/board/items/new',
  '/board/items/:id',
  '/moves/new',
  '/moves/quick',
  '/moves/:id',
  '/settings/evaluation',
  '/settings/triggers',
  '/goals/new',
  '/goals/:id',
  '/goals/:id/kizami',
  '/goals/:id/recut',
  '/goals/:id/extend',
  '/judge/:goalId',
  '/measure/new',
  '/review',
  '/review/weekly/:weekStart',
  '/review/numbers',
  '/review/calibration',
  '/review/patterns',
  '/review/experiment',
  '/library',
  '/library/habits',
  '/library/tasks',
  '/library/goals',
  '/library/metrics',
  '/library/moves',
  '/library/joseki',
  '/library/history',
  '/settings',
  '/settings/data',
];

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      ...placeholderPaths.map((path) => ({ path, element: <Placeholder /> })),
      { path: '*', element: <Placeholder /> },
    ],
  },
];
