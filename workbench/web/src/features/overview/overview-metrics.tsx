import { Activity, AlertTriangle, Gauge, Globe2, Rocket } from 'lucide-react';
import { MetricCard } from '../performance/metric-card';
import type { PerformanceOverview } from '../../shared/datasource/types';

export function OverviewMetrics({ overview }: { overview?: PerformanceOverview }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      <MetricCard title="Startup" icon={Rocket} summary={overview?.startup} emphasis="cold / hot" />
      <MetricCard title="Pages" icon={Gauge} summary={overview?.pages} emphasis="route" />
      <MetricCard title="HTTP" icon={Globe2} summary={overview?.http} emphasis="network" />
      <MetricCard title="Jank" icon={Activity} summary={overview?.jank} emphasis="frame" />
      <MetricCard title="Errors" icon={AlertTriangle} summary={overview?.errors} emphasis="stability" />
    </div>
  );
}
