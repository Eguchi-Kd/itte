import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { AppLayout } from './ui/screens/AppLayout';

// 画面はルートごとに遅延読み込みする（§6.1.2）。T13 以降のモジュールはまだ空の画面
const Placeholder = lazy(() => import('./ui/screens/Placeholder'));
const Numbers = lazy(() => import('./ui/screens/review/Numbers'));
const Patterns = lazy(() => import('./ui/screens/review/Patterns'));
const WeeklyLesson = lazy(() => import('./ui/screens/review/WeeklyLesson'));
const ReviewTab = lazy(() => import('./ui/screens/review/ReviewTab'));
const Calibration = lazy(() => import('./ui/screens/review/Calibration'));
const JudgmentHistory = lazy(() => import('./ui/screens/goals/JudgmentHistory'));
const GoalList = lazy(() => import('./ui/screens/goals/GoalList'));
const GoalDetail = lazy(() => import('./ui/screens/goals/GoalDetail'));
const JudgeLesson = lazy(() => import('./ui/screens/goals/JudgeLesson'));
const MetricList = lazy(() => import('./ui/screens/goals/MetricList'));
const MeasureNew = lazy(() => import('./ui/screens/goals/MeasureNew'));
const GoalExtend = lazy(() => import('./ui/screens/goals/GoalExtend'));
const GoalRecut = lazy(() => import('./ui/screens/goals/GoalRecut'));
const GoalKizami = lazy(() => import('./ui/screens/goals/GoalKizami'));
const GoalNew = lazy(() => import('./ui/screens/goals/GoalNew'));
const MoveList = lazy(() => import('./ui/screens/moves/MoveList'));
const JosekiList = lazy(() => import('./ui/screens/moves/JosekiList'));
const MoveDecide = lazy(() => import('./ui/screens/moves/MoveDecide'));
const MoveQuick = lazy(() => import('./ui/screens/moves/MoveQuick'));
const MoveNew = lazy(() => import('./ui/screens/moves/MoveNew'));
const TriggerSettings = lazy(() => import('./ui/screens/board/TriggerSettings'));
const EvaluationSettings = lazy(() => import('./ui/screens/board/EvaluationSettings'));
const BoardItemEdit = lazy(() => import('./ui/screens/board/BoardItemEdit'));
const BoardItemNew = lazy(() => import('./ui/screens/board/BoardItemEdit'));
const Board = lazy(() => import('./ui/screens/board/Board'));
const Daily = lazy(() => import('./ui/screens/start/Daily'));
const EscapeNew = lazy(() => import('./ui/screens/start/EscapeNew'));
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
  '/review/experiment',
  '/settings',
  '/settings/data',
];

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/review/numbers', element: <Numbers /> },
      { path: '/review/patterns', element: <Patterns /> },
      { path: '/review/weekly/:weekStart', element: <WeeklyLesson /> },
      { path: '/review', element: <ReviewTab /> },
      { path: '/review/calibration', element: <Calibration /> },
      { path: '/library/history', element: <JudgmentHistory /> },
      { path: '/library/goals', element: <GoalList /> },
      { path: '/goals/:id', element: <GoalDetail /> },
      { path: '/judge/:goalId', element: <JudgeLesson /> },
      { path: '/library/metrics', element: <MetricList /> },
      { path: '/measure/new', element: <MeasureNew /> },
      { path: '/goals/:id/extend', element: <GoalExtend /> },
      { path: '/goals/:id/recut', element: <GoalRecut /> },
      { path: '/goals/:id/kizami', element: <GoalKizami /> },
      { path: '/goals/new', element: <GoalNew /> },
      { path: '/library/moves', element: <MoveList /> },
      { path: '/library/joseki', element: <JosekiList /> },
      { path: '/moves/:id', element: <MoveDecide /> },
      { path: '/moves/quick', element: <MoveQuick /> },
      { path: '/moves/new', element: <MoveNew /> },
      { path: '/settings/triggers', element: <TriggerSettings /> },
      { path: '/settings/evaluation', element: <EvaluationSettings /> },
      { path: '/board/items/:id', element: <BoardItemEdit /> },
      { path: '/board/items/new', element: <BoardItemNew /> },
      { path: '/board', element: <Board /> },
      { path: '/daily', element: <Daily /> },
      { path: '/escape/new', element: <EscapeNew /> },
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
