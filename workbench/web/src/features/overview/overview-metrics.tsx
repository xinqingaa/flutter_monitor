import { Activity, AlertTriangle, Gauge, Globe2, Rocket } from 'lucide-react';
import { MetricCard } from '../performance/metric-card';
import type { PerformanceOverview } from '../../shared/datasource/types';

export function OverviewMetrics({ overview }: { overview?: PerformanceOverview }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard title="启动耗时" icon={Rocket} summary={overview?.startup} emphasis="冷启 / 热启" />
      <MetricCard title="页面性能" icon={Gauge} summary={overview?.pages} emphasis="页面打开" />
      <MetricCard title="网络请求" icon={Globe2} summary={overview?.http} emphasis="HTTP" />
      <MetricCard title="卡顿" icon={Activity} summary={overview?.jank} emphasis="帧耗时" />
      <MetricCard title="错误" icon={AlertTriangle} summary={overview?.errors} emphasis="稳定性" />
    </div>
  );
}
