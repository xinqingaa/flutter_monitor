import { AlertTriangle, ExternalLink, GitBranch } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/common/status-badge';
import { Button } from '../../components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../components/ui/empty';
import { Separator } from '../../components/ui/separator';
import { CopyableId } from '../../components/common/copyable-id';
import type { HttpCatalogItem } from '../../shared/datasource/types';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';

export function CatalogPreviewPane({ item, loading, error, onOpen }: { item?: HttpCatalogItem; loading?: boolean; error?: boolean; onOpen: () => void }) {
  if (loading) return <PreviewMessage text="正在加载摘要" />;
  if (error) return <PreviewMessage text="摘要加载失败" />;
  if (!item) return <PreviewMessage text="选择一行查看摘要" />;
  const failed = item.success === false;
  return (
    <div className="flex flex-col gap-5 p-6 text-sm">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={failed ? 'danger' : 'good'}>{failed ? '失败' : '成功'}</Badge><span className="font-mono font-medium">{item.method ?? 'HTTP'}</span></div>
        <p className="break-all font-mono text-sm leading-6">{item.url ?? '缺少 URL'}</p>
      </div>
      {item.detailDropped ? <Alert><AlertTriangle /><AlertTitle>请求详情不可用</AlertTitle><AlertDescription>SDK 已剥离本次请求详情，列表事实字段仍然可用。</AlertDescription></Alert> : null}
      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-3">
        <Dt>HTTP 状态</Dt><Dd>{item.statusCode ?? '-'}</Dd><Dt>业务码</Dt><Dd>{businessCode(item)}</Dd><Dt>耗时</Dt><Dd>{formatDuration(item.durationMs)}</Dd><Dt>响应大小</Dt><Dd>{bytes(item.responseSizeBytes)}</Dd><Dt>关联路由</Dt><Dd>{item.route ?? '-'}</Dd><Dt>时间</Dt><Dd>{formatDateTime(item.timestamp)}</Dd>
      </dl>
      <Separator />
      <section className="grid gap-3"><IdRow label="Event" value={item.eventId} /><IdRow label="Session" value={item.sessionId} /><IdRow label="Trace" value={item.traceId} /><IdRow label="Request" value={item.requestId} /></section>
      <div className="grid gap-2">
        <Button onClick={onOpen}><ExternalLink />打开详情</Button>
        {item.sessionId ? <Button variant="outline" asChild><Link to="/sessions/$sessionId" params={{ sessionId: item.sessionId }} search={{ eventId: item.eventId }}><GitBranch />查看 Session</Link></Button> : null}
      </div>
    </div>
  );
}
function PreviewMessage({ text }: { text: string }) { return <Empty className="h-full border-0"><EmptyHeader><EmptyTitle>{text}</EmptyTitle><EmptyDescription>从 HTTP 表格中选择一条记录。</EmptyDescription></EmptyHeader></Empty>; }
function Dt({ children }: { children: React.ReactNode }) { return <dt className="text-muted-foreground">{children}</dt>; }
function Dd({ children }: { children: React.ReactNode }) { return <dd className="min-w-0 truncate text-right font-medium tabular-nums">{children}</dd>; }
function IdRow({ label, value }: { label: string; value?: string }) { return <div className="flex min-w-0 items-center justify-between gap-2"><span className="text-muted-foreground">{label}</span><CopyableId value={value} /></div>; }
function bytes(value?: number) { return value === undefined ? '-' : value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`; }
function businessCode(item: HttpCatalogItem) { return item.businessCode ?? (item.businessCodeState === 'parse_failed' ? '解析失败' : item.businessCodeState === 'detail_unavailable' ? '详情不可用' : '-'); }
