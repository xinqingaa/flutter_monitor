import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { WorkbenchShell } from './workbench-shell';
import { OverviewRoute } from '../routes/overview/overview-route';
import { SessionsRoute } from '../routes/sessions/sessions-route';
import { SessionDetailRoute } from '../routes/session-detail/session-detail-route';
import { EventsRoute } from '../routes/events/events-route';
import { EventDetailRoute } from '../routes/event-detail/event-detail-route';
import { TraceDetailRoute } from '../routes/trace-detail/trace-detail-route';
import { ErrorsRoute, JankRoute, NetworkRoute, PagesRoute, StartupRoute } from '../routes/performance/performance-routes';

const rootRoute = createRootRoute({
  component: WorkbenchShell,
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: OverviewRoute,
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: SessionsRoute,
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$sessionId',
  component: SessionDetailRoute,
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  component: EventsRoute,
});

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId',
  component: EventDetailRoute,
});

const startupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/startup',
  component: StartupRoute,
});

const pagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pages',
  component: PagesRoute,
});

const networkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/network',
  component: NetworkRoute,
});

const jankRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jank',
  component: JankRoute,
});

const errorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/errors',
  component: ErrorsRoute,
});

const traceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/traces/$traceId',
  component: TraceDetailRoute,
});

const routeTree = rootRoute.addChildren([
  overviewRoute,
  sessionsRoute,
  sessionRoute,
  eventsRoute,
  eventRoute,
  startupRoute,
  pagesRoute,
  networkRoute,
  jankRoute,
  errorsRoute,
  traceRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
