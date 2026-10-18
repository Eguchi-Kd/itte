import { Suspense } from 'react';
import { Outlet } from 'react-router';

export function AppLayout() {
  return (
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  );
}
