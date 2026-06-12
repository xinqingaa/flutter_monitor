import type { SessionSummary } from '../../shared/datasource/types';
import type * as React from 'react';
import { SessionSummaryCard } from '../session/session-summary-card';

export function RecentLiveSession({
  session,
  live,
  compact = false,
  panelAction,
  title,
}: {
  session?: SessionSummary;
  live: boolean;
  compact?: boolean;
  panelAction?: React.ReactNode;
  title?: string;
}) {
  return (
    <SessionSummaryCard
      session={session}
      live={live}
      title={title}
      panelAction={panelAction}
    />
  );
}
