import { ExternalLink } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { CopyableId } from '../../components/common/copyable-id';
import { RecordShell } from '../inspector/record-shell';
import type { SessionSummary } from '../../shared/datasource/types';
import { statusLabel } from '../../shared/event-model/status';
import { formatDateTime } from '../../shared/formatting/format';
import { problemCount } from './session-catalog-table';

export function SessionRecord({
  open,
  item,
  onOpenChange,
  onExpand,
}: {
  open: boolean;
  item?: SessionSummary;
  onOpenChange: (open: boolean) => void;
  onExpand?: (sessionId: string) => void;
}) {
  return (
    <RecordShell
      open={open}
      onOpenChange={onOpenChange}
      title={item ? shortId(item.sessionId) : 'Session 预览'}
      description={item?.sessionId}
      state={!item ? 'notFound' : 'ready'}
      summary={item ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.status === 'error' ? 'destructive' : 'secondary'}>{statusLabel(item.status)}</Badge>
          <span className="text-sm text-muted-foreground">{problemCount(item)} 个问题 · {item.count} 个事件</span>
        </div>
      ) : undefined}
      headerActions={item && onExpand ? (
        <Button size="sm" variant="outline" onClick={() => onExpand(item.sessionId)}>
          <ExternalLink data-icon="inline-start" />
          全屏
        </Button>
      ) : undefined}
    >
      {item ? (
        <div className="flex flex-col gap-6 p-6 text-sm">
          <FactList
            facts={[
              { label: '路由', value: item.route ?? '-' },
              { label: '用户', value: item.userId ?? '-' },
              { label: '版本', value: item.appVersion ?? '-' },
              { label: '环境', value: item.environment ?? '-' },
              { label: '平台', value: item.devicePlatform ?? '-' },
              { label: '设备', value: item.deviceModel ?? '-' },
              { label: '错误', value: item.errorCount },
              { label: '失败 HTTP', value: item.failedHttpCount },
              { label: '业务失败', value: item.businessFailureCount ?? 0 },
              { label: '开始', value: formatDateTime(item.firstTimestamp) },
              { label: '结束', value: formatDateTime(item.lastTimestamp) },
            ]}
          />
          <div className="grid gap-3">
            <IdRow label="Session" value={item.sessionId} />
            <IdRow label="最近事件" value={item.lastEventId} />
          </div>
        </div>
      ) : null}
    </RecordShell>
  );
}

function FactList({ facts }: { facts: Array<{ label: string; value: string | number }> }) {
  return (
    <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-3">
      {facts.map((fact) => (
        <div key={fact.label} className="contents">
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="min-w-0 truncate text-right font-medium tabular-nums">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function IdRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <CopyableId value={value} short={false} />
    </div>
  );
}

function shortId(value: string) {
  return value.length <= 20 ? value : `${value.slice(0, 10)}...${value.slice(-6)}`;
}
