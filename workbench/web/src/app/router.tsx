import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { WorkbenchShell } from './workbench-shell';
import { OverviewRoute } from '../routes/overview/overview-route';
import { SessionDetailRoute } from '../routes/session-detail/session-detail-route';
import { EventDetailRoute } from '../routes/event-detail/event-detail-route';
import { TraceDetailRoute } from '../routes/trace-detail/trace-detail-route';

const rootRoute = createRootRoute({
  component: WorkbenchShell,
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: OverviewRoute,
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$sessionId',
  component: SessionDetailRoute,
});

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId',
  component: EventDetailRoute,
});

const traceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/traces/$traceId',
  component: TraceDetailRoute,
});

const routeTree = rootRoute.addChildren([overviewRoute, sessionRoute, eventRoute, traceRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
