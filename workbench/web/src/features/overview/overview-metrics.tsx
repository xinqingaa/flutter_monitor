import { Activity, AlertTriangle, Gauge, Globe2, Rocket } from 'lucide-react';
import { MetricCard } from '../performance/metric-card';
import type { PerformanceOverview } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';

export function OverviewMetrics({
  overview,
  variant = 'compact',
}: {
  overview?: PerformanceOverview;
  variant?: 'compact' | 'focus';
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-2 sm:grid-cols-2',
        variant === 'compact' && 'xl:grid-cols-5',
        variant === 'focus' && 'xl:grid-cols-2 2xl:grid-cols-3 [&>a:first-child]:2xl:col-span-2',
      )}
    >
      <MetricCard kind="startup" title="启动链路" icon={Rocket} summary={overview?.startup} emphasis="冷启 / 后台" to="/startup" />
      <MetricCard kind="pages" title="页面性能" icon={Gauge} summary={overview?.pages} emphasis="加载 / 停留" to="/pages" />
      <MetricCard kind="network" title="网络请求" icon={Globe2} summary={overview?.http} emphasis="HTTP" to="/network" />
      <MetricCard kind="jank" title="卡顿" icon={Activity} summary={overview?.jank} emphasis="帧耗时" to="/jank" />
      <MetricCard kind="errors" title="稳定性错误" icon={AlertTriangle} summary={overview?.errors} emphasis="稳定性" to="/errors" />
    </div>
  );
}
