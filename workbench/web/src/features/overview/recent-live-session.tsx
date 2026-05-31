import type { SessionSummary } from '../../shared/datasource/types';
import { SessionSummaryCard } from '../session/session-summary-card';

export function RecentLiveSession({ session, live, compact = false }: { session?: SessionSummary; live: boolean; compact?: boolean }) {
  return (
    <SessionSummaryCard
      session={session}
      live={live}
      description={compact ? '刚复现的链路会自动浮出。' : '刚复现的链路自动浮在这里，便于本地实时自调试。'}
    />
  );
}
