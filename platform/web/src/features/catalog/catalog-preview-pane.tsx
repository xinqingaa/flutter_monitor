import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/common/status-badge';
import type { HttpCatalogItem } from '../../shared/datasource/types';
import { CatalogLabels } from '../../shared/event-model/catalog-labels';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';
import { CatalogPreviewShell } from './catalog-preview-shell';

export function CatalogPreviewPane({
  item,
  loading,
  error,
  onOpen,
  onPeek,
}: {
  item?: HttpCatalogItem;
  loading?: boolean;
  error?: boolean;
  onOpen: () => void;
  onPeek: () => void;
}) {
  const failed = item?.success === false;

  return (
    <CatalogPreviewShell
      selected={Boolean(item)}
      loading={loading}
      error={error}
      emptyDescription="从 HTTP 表格中选择一条记录。"
      header={item ? (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={failed ? 'danger' : 'good'}>{failed ? '失败' : '成功'}</Badge>
            <span className="font-mono font-medium">{item.method ?? 'HTTP'}</span>
          </div>
          <p className="break-all font-mono text-sm leading-6">{item.url ?? '缺少 URL'}</p>
        </div>
      ) : undefined}
      notice={item?.detailDropped ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>请求详情不可用</AlertTitle>
          <AlertDescription>SDK 已剥离本次请求详情，列表事实字段仍然可用。</AlertDescription>
        </Alert>
      ) : undefined}
      facts={item ? [
        { label: 'HTTP 状态', value: item.statusCode ?? '-' },
        { label: CatalogLabels.businessCode, value: businessCode(item) },
        { label: CatalogLabels.duration, value: formatDuration(item.durationMs) },
        { label: '响应大小', value: bytes(item.responseSizeBytes) },
        { label: CatalogLabels.route, value: item.route ?? '-' },
        { label: CatalogLabels.user, value: item.userId ?? '-' },
        { label: CatalogLabels.version, value: item.appVersion ?? '-' },
        { label: CatalogLabels.environment, value: item.environment ?? '-' },
        { label: CatalogLabels.platform, value: item.devicePlatform ?? '-' },
        { label: CatalogLabels.time, value: formatDateTime(item.timestamp) },
      ] : undefined}
      ids={item ? [
        { label: CatalogLabels.eventId, value: item.eventId },
        { label: CatalogLabels.session, value: item.sessionId },
        { label: CatalogLabels.trace, value: item.traceId },
        { label: CatalogLabels.requestId, value: item.requestId },
      ] : undefined}
      eventId={item?.eventId}
      sessionId={item?.sessionId}
      onOpen={onOpen}
      onPeek={onPeek}
    />
  );
}

function bytes(value?: number) {
  return value === undefined ? '-' : value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`;
}

function businessCode(item: HttpCatalogItem) {
  return item.businessCode
    ?? (item.businessCodeState === 'parse_failed'
      ? '解析失败'
      : item.businessCodeState === 'detail_unavailable'
        ? '详情不可用'
        : '-');
}
