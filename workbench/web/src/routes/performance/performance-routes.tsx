import { Activity, AlertTriangle, Gauge, Globe2, Rocket } from 'lucide-react';
import { PerformanceDetailPage } from '../../features/performance/performance-detail-page';
import { usePerformanceQuery } from '../../shared/datasource/queries';

function usePerformancePageQuery() {
  return usePerformanceQuery({ limit: 200 });
}

export function StartupRoute() {
  const query = usePerformancePageQuery();
  return (
    <PerformanceDetailPage
      kind="startup"
      title="启动链路"
      description="启动页读取冷启动、热重启、SDK 初始化和后台间隔。"
      icon={Rocket}
      metric={query.data?.startup}
      emphasis="冷启 / 后台"
    />
  );
}

export function PagesRoute() {
  const query = usePerformancePageQuery();
  return (
    <PerformanceDetailPage
      kind="pages"
      title="页面性能"
      description="页面页只读取 page.load、page.first_frame 和 page.stay，不把 route.push 计入性能耗时。"
      icon={Gauge}
      metric={query.data?.pages}
      emphasis="页面打开"
    />
  );
}

export function NetworkRoute() {
  const query = usePerformancePageQuery();
  return (
    <PerformanceDetailPage
      kind="network"
      title="网络请求"
      description="网络页读取 completed single-span HTTP envelope：name=http.client 且 event.phase=instant。"
      icon={Globe2}
      metric={query.data?.http}
      emphasis="HTTP"
    />
  );
}

export function JankRoute() {
  const query = usePerformancePageQuery();
  return (
    <PerformanceDetailPage
      kind="jank"
      title="卡顿"
      description="卡顿页读取 ui.jank.sequence 携带的 frame.* 与 jank.count 字段。"
      icon={Activity}
      metric={query.data?.jank}
      emphasis="帧耗时"
    />
  );
}

export function ErrorsRoute() {
  const query = usePerformancePageQuery();
  return (
    <PerformanceDetailPage
      kind="errors"
      title="错误"
      description="错误页读取稳定性错误，不混入 completed HTTP 失败；失败请求请在网络页查看。"
      icon={AlertTriangle}
      metric={query.data?.errors}
      emphasis="稳定性"
    />
  );
}
