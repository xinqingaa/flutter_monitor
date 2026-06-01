import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router';
import { WorkbenchShell } from './workbench-shell';

const rootRoute = createRootRoute({
  component: WorkbenchShell,
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('../routes/overview/overview-route'), 'OverviewRoute'),
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: lazyRouteComponent(() => import('../routes/sessions/sessions-route'), 'SessionsRoute'),
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$sessionId',
  validateSearch: (search: Record<string, unknown>): { eventId?: string; traceId?: string } => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
    traceId: typeof search.traceId === 'string' ? search.traceId : undefined,
  }),
  component: lazyRouteComponent(() => import('../routes/session-detail/session-detail-route'), 'SessionDetailRoute'),
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  component: lazyRouteComponent(() => import('../routes/events/events-route'), 'EventsRoute'),
});

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId',
  component: lazyRouteComponent(() => import('../routes/event-detail/event-detail-route'), 'EventDetailRoute'),
});

const startupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/startup',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'StartupRoute'),
});

const pagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pages',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'PagesRoute'),
});

const networkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/network',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'NetworkRoute'),
});

const jankRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jank',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'JankRoute'),
});

const errorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/errors',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'ErrorsRoute'),
});

const traceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/traces/$traceId',
  component: lazyRouteComponent(() => import('../routes/trace-detail/trace-detail-route'), 'TraceDetailRoute'),
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
