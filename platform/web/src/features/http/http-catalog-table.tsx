import { ExternalLink, MoreHorizontal } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import type { HttpCatalogItem } from '../../shared/datasource/types';
import { formatDuration, formatTime } from '../../shared/formatting/format';
import { cn } from '../../shared/formatting/cn';

export type CatalogState = 'loading' | 'ready' | 'empty' | 'noResults' | 'error' | 'partial';

export function HttpCatalogTable({ items, state, selectedId, fullUrl, slowThresholdMs, onSelect, onOpen, onRetry }: {
  items: HttpCatalogItem[];
  state: CatalogState;
  selectedId?: string;
  fullUrl: boolean;
  slowThresholdMs: number;
  onSelect: (item: HttpCatalogItem) => void;
  onOpen: (item: HttpCatalogItem) => void;
  onRetry: () => void;
}) {
  if (state !== 'ready' && state !== 'partial') {
    return <CatalogMessage state={state} onRetry={onRetry} />;
  }
  return (
    <div className="h-full overflow-auto bg-surface">
      {state === 'partial' ? <div className="sticky top-0 z-20 border-b border-status-warning bg-status-warning-subtle px-3 py-1 text-xs text-status-warning">部分 HTTP 详情已被剥离，列表事实字段仍可查询。</div> : null}
      <Table className="min-w-[760px] table-fixed text-left text-xs">
        <TableHeader className="sticky top-0 z-10 bg-subtle text-text-secondary">
          <TableRow className="h-9 border-border-default hover:bg-subtle">
            <TableHead className="w-[150px] px-2">时间</TableHead><TableHead className="w-[70px] px-2">方法</TableHead><TableHead className="px-2">URL</TableHead><TableHead className="w-[72px] px-2 text-right">状态码</TableHead><TableHead className="w-[88px] px-2 text-right max-[1180px]:hidden">业务码</TableHead><TableHead className="w-[82px] px-2 text-right">耗时</TableHead><TableHead className="w-[120px] px-2 max-[1180px]:hidden">关联路由</TableHead><TableHead className="w-[54px] px-2" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const failed = item.success === false;
            const slow = (item.durationMs ?? 0) >= slowThresholdMs;
            return (
              <TableRow
                key={item.eventId}
                tabIndex={0}
                aria-selected={item.eventId === selectedId}
                className={cn('h-9 cursor-default border-b border-border-muted text-text-primary outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-interactive-focusRing', item.eventId === selectedId && 'bg-selected')}
                onClick={() => onSelect(item)}
                onDoubleClick={() => onOpen(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onOpen(item);
                  if (event.key === ' ') { event.preventDefault(); onSelect(item); }
                }}
              >
                <TableCell className="overflow-hidden px-2 font-mono text-[11px] text-text-secondary" title={item.timestamp}>{formatTime(item.timestamp)}</TableCell>
                <TableCell className="overflow-hidden px-2"><span className="font-mono font-semibold">{item.method ?? '-'}</span></TableCell>
                <TableCell className="overflow-hidden px-2"><span title={item.url} className="block truncate font-mono">{displayUrl(item.url, fullUrl)}</span></TableCell>
                <TableCell className={cn('overflow-hidden px-2 text-right font-mono tabular-nums', failed && 'font-semibold text-status-danger')}>{item.statusCode ?? '-'}</TableCell>
                <TableCell className="overflow-hidden px-2 text-right font-mono tabular-nums max-[1180px]:hidden"><span title={businessCodeTitle(item)}>{item.businessCode ?? stateMark(item.businessCodeState)}</span></TableCell>
                <TableCell className={cn('overflow-hidden px-2 text-right font-mono tabular-nums', slow && 'font-semibold text-status-warning')}>{formatDuration(item.durationMs)}</TableCell>
                <TableCell className="overflow-hidden px-2 max-[1180px]:hidden"><span className="block truncate" title={item.route}>{item.route ?? '-'}</span></TableCell>
                <TableCell className="overflow-hidden px-2"><Button size="icon" variant="ghost" className="size-7" aria-label="打开 HTTP 详情" onClick={(event) => { event.stopPropagation(); onOpen(item); }}><ExternalLink /></Button></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CatalogMessage({ state, onRetry }: { state: Exclude<CatalogState, 'ready' | 'partial'>; onRetry: () => void }) {
  const content = state === 'loading' ? ['正在加载 HTTP 请求', ''] : state === 'empty' ? ['暂无 HTTP 请求', '等待应用产生网络请求。'] : state === 'noResults' ? ['没有匹配结果', '调整或清除筛选条件。'] : ['HTTP 请求加载失败', '请检查 Monitor Service 后重试。'];
  return <div className="grid h-full place-items-center p-6 text-center"><div><MoreHorizontal className="mx-auto mb-2 size-5 text-text-muted" /><p className="text-sm font-medium text-text-primary">{content[0]}</p><p className="mt-1 text-xs text-text-secondary">{content[1]}</p>{state === 'error' ? <Button className="mt-3" size="sm" onClick={onRetry}>重试</Button> : null}</div></div>;
}

function displayUrl(url: string | undefined, full: boolean): string {
  if (!url || full) return url ?? '-';
  try { const parsed = new URL(url); return `${parsed.pathname}${parsed.search}`; } catch { return url; }
}
function stateMark(state: HttpCatalogItem['businessCodeState']) { return state === 'parse_failed' ? '解析失败' : state === 'detail_unavailable' ? '详情缺失' : '-'; }
function businessCodeTitle(item: HttpCatalogItem) { return item.businessCode ?? (item.businessCodeState === 'parse_failed' ? '响应 body 无法解析为含顶层 code 的 JSON' : item.businessCodeState === 'detail_unavailable' ? '详情被剥离或 body 被截断' : '响应中没有顶层 code'); }
