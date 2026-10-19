import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { AppLayout } from './ui/screens/AppLayout';

// 画面はルートごとに遅延読み込みする（§6.1.2）。T13 以降のモジュールはまだ空の画面
const Placeholder = lazy(() => import('./ui/screens/Placeholder'));
const SessionEnd = lazy(() => import('./ui/screens/start/SessionEnd'));
const SessionTimer = lazy(() => import('./ui/screens/start/SessionTimer'));
const TaskList = lazy(() => import('./ui/screens/start/TaskList'));
const TaskDetail = lazy(() => import('./ui/screens/start/TaskDetail'));
const TaskNew = lazy(() => import('./ui/screens/start/TaskNew'));
const Onboarding = lazy(() => import('./ui/screens/onboarding/Onboarding'));
const HabitWizard = lazy(() => import('./ui/screens/habits/HabitWizard'));
const Home = lazy(() => import('./ui/screens/today/Home'));
const HabitDetail = lazy(() => import('./ui/screens/habits/HabitDetail'));
const HabitEdit = lazy(() => import('./ui/screens/habits/HabitEdit'));
const HabitList = lazy(() => import('./ui/screens/habits/HabitList'));
const Library = lazy(() => import('./ui/screens/library/Library'));

const placeholderPaths = [
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
      { path: '/session/:id/end', element: <SessionEnd /> },
      { path: '/session/:id', element: <SessionTimer /> },
      { path: '/library/tasks', element: <TaskList /> },
      { path: '/tasks/:id', element: <TaskDetail /> },
      { path: '/tasks/new', element: <TaskNew /> },
      { path: '/', element: <Home /> },
      { path: '/onboarding', element: <Onboarding /> },
      { path: '/habits/new', element: <HabitWizard /> },
      { path: '/habits/:id', element: <HabitDetail /> },
      { path: '/habits/:id/edit', element: <HabitEdit /> },
      { path: '/library', element: <Library /> },
      { path: '/library/habits', element: <HabitList /> },
      ...placeholderPaths.map((path) => ({ path, element: <Placeholder /> })),
      { path: '*', element: <Placeholder /> },
    ],
  },
];
