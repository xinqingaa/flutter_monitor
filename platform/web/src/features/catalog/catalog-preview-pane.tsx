import { ExternalLink, GitBranch } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { CopyableId } from '../../components/common/copyable-id';
import type { HttpCatalogItem } from '../../shared/datasource/types';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';

export function CatalogPreviewPane({ item, loading, error, onOpen }: { item?: HttpCatalogItem; loading?: boolean; error?: boolean; onOpen: () => void }) {
  if (loading) return <PreviewMessage text="正在加载摘要" />;
  if (error) return <PreviewMessage text="摘要加载失败" />;
  if (!item) return <PreviewMessage text="选择一行查看摘要" />;
  const failed = item.success === false;
  return (
    <div className="grid gap-4 p-3 pt-12 text-xs">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={failed ? 'danger' : 'good'}>{failed ? '失败' : '成功'}</Badge><span className="font-mono font-semibold text-text-primary">{item.method ?? 'HTTP'}</span></div>
        <p className="break-all font-mono text-[13px] leading-5 text-text-primary">{item.url ?? '缺少 URL'}</p>
      </div>
      {item.detailDropped ? <div className="rounded-panel border border-status-warning bg-status-warning-subtle p-2 text-status-warning">SDK 已剥离本次请求详情，事实字段仍然可用。</div> : null}
      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-2">
        <Dt>HTTP 状态</Dt><Dd>{item.statusCode ?? '-'}</Dd><Dt>业务码</Dt><Dd>{businessCode(item)}</Dd><Dt>耗时</Dt><Dd>{formatDuration(item.durationMs)}</Dd><Dt>响应大小</Dt><Dd>{bytes(item.responseSizeBytes)}</Dd><Dt>关联路由</Dt><Dd>{item.route ?? '-'}</Dd><Dt>时间</Dt><Dd>{formatDateTime(item.timestamp)}</Dd>
      </dl>
      <section className="grid gap-2 border-t border-border-default pt-3"><IdRow label="Event" value={item.eventId} /><IdRow label="Session" value={item.sessionId} /><IdRow label="Trace" value={item.traceId} /><IdRow label="Request" value={item.requestId} /></section>
      <div className="grid gap-2">
        <Button onClick={onOpen}><ExternalLink />打开详情</Button>
        {item.sessionId ? <Button asChild><Link to="/sessions/$sessionId" params={{ sessionId: item.sessionId }} search={{ eventId: item.eventId }}><GitBranch />查看 Session</Link></Button> : null}
      </div>
    </div>
  );
}
function PreviewMessage({ text }: { text: string }) { return <div className="grid h-full place-items-center p-6 text-sm text-text-muted">{text}</div>; }
function Dt({ children }: { children: React.ReactNode }) { return <dt className="text-text-secondary">{children}</dt>; }
function Dd({ children }: { children: React.ReactNode }) { return <dd className="min-w-0 truncate text-right font-medium tabular-nums text-text-primary">{children}</dd>; }
function IdRow({ label, value }: { label: string; value?: string }) { return <div className="flex min-w-0 items-center justify-between gap-2"><span className="text-text-secondary">{label}</span><CopyableId value={value} /></div>; }
function bytes(value?: number) { return value === undefined ? '-' : value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`; }
function businessCode(item: HttpCatalogItem) { return item.businessCode ?? (item.businessCodeState === 'parse_failed' ? '解析失败' : item.businessCodeState === 'detail_unavailable' ? '详情不可用' : '-'); }
