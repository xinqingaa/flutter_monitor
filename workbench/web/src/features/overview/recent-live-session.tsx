import type { SessionSummary } from '../../shared/datasource/types';
import type * as React from 'react';
import { SessionSummaryCard } from '../session/session-summary-card';

export function RecentLiveSession({
  session,
  live,
  compact = false,
  panelAction,
}: {
  session?: SessionSummary;
  live: boolean;
  compact?: boolean;
  panelAction?: React.ReactNode;
}) {
  return (
    <SessionSummaryCard
      session={session}
      live={live}
      description={compact ? '刚复现的链路会自动浮出。' : '刚复现的链路自动浮在这里，便于本地实时自调试。'}
      panelAction={panelAction}
    />
  );
}
