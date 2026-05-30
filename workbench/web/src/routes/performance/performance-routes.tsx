import { Activity, AlertTriangle, Gauge, Globe2, Rocket } from 'lucide-react';
import { PerformanceDetailPage } from '../../features/performance/performance-detail-page';
import { usePerformanceQuery } from '../../shared/datasource/queries';

export function StartupRoute() {
  const query = usePerformanceQuery({ limit: 200 });
  return (
    <PerformanceDetailPage
      title="启动耗时"
      description="冷启动和热启动后续会拆成独立曲线，支持慢启动阈值和点位回查。"
      icon={Rocket}
      metric={query.data?.startup}
      emphasis="冷启 / 热启"
    />
  );
}

export function PagesRoute() {
  const query = usePerformanceQuery({ limit: 200 });
  return (
    <PerformanceDetailPage
      title="页面性能"
      description="页面进入、页面停留和页面稳定性后续会按 route 聚合，定位慢页面和问题页面。"
      icon={Gauge}
      metric={query.data?.pages}
      emphasis="页面打开"
    />
  );
}

export function NetworkRoute() {
  const query = usePerformanceQuery({ limit: 200 });
  return (
    <PerformanceDetailPage
      title="网络请求"
      description="请求耗时、失败请求和慢请求后续会按接口、页面和 session 聚合。"
      icon={Globe2}
      metric={query.data?.http}
      emphasis="HTTP"
    />
  );
}

export function JankRoute() {
  const query = usePerformanceQuery({ limit: 200 });
  return (
    <PerformanceDetailPage
      title="卡顿"
      description="卡顿记录后续会关联页面、设备等级、帧耗时和 session timeline。"
      icon={Activity}
      metric={query.data?.jank}
      emphasis="帧耗时"
    />
  );
}

export function ErrorsRoute() {
  const query = usePerformanceQuery({ limit: 200 });
  return (
    <PerformanceDetailPage
      title="错误"
      description="错误入口后续会统一承接异常、失败请求、内存压力和 native 问题。"
      icon={AlertTriangle}
      metric={query.data?.errors}
      emphasis="稳定性"
    />
  );
}
