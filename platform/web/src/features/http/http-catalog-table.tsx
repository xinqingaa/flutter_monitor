import { ExternalLink, MoreHorizontal } from 'lucide-react';
import { Button } from '../../components/ui/button';
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
      <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-subtle text-text-secondary">
          <tr className="h-9 border-b border-border-default">
            <Th className="w-[105px]">时间</Th><Th className="w-[70px]">方法</Th><Th>URL</Th><Th className="w-[72px] text-right">状态码</Th><Th className="w-[88px] text-right max-[1180px]:hidden">业务码</Th><Th className="w-[82px] text-right">耗时</Th><Th className="w-[120px] max-[1180px]:hidden">关联路由</Th><Th className="w-[54px]" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const failed = item.success === false;
            const slow = (item.durationMs ?? 0) >= slowThresholdMs;
            return (
              <tr
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
                <Td className="font-mono text-[11px] text-text-secondary">{formatTime(item.timestamp)}</Td>
                <Td><span className="font-mono font-semibold">{item.method ?? '-'}</span></Td>
                <Td><span title={item.url} className="block truncate font-mono">{displayUrl(item.url, fullUrl)}</span></Td>
                <Td className={cn('text-right font-mono tabular-nums', failed && 'font-semibold text-status-danger')}>{item.statusCode ?? '-'}</Td>
                <Td className="text-right font-mono tabular-nums max-[1180px]:hidden"><span title={businessCodeTitle(item)}>{item.businessCode ?? stateMark(item.businessCodeState)}</span></Td>
                <Td className={cn('text-right font-mono tabular-nums', slow && 'font-semibold text-status-warning')}>{formatDuration(item.durationMs)}</Td>
                <Td className="max-[1180px]:hidden"><span className="block truncate" title={item.route}>{item.route ?? '-'}</span></Td>
                <Td><Button size="icon" variant="ghost" className="size-7" aria-label="打开 HTTP 详情" onClick={(event) => { event.stopPropagation(); onOpen(item); }}><ExternalLink /></Button></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CatalogMessage({ state, onRetry }: { state: Exclude<CatalogState, 'ready' | 'partial'>; onRetry: () => void }) {
  const content = state === 'loading' ? ['正在加载 HTTP 请求', ''] : state === 'empty' ? ['暂无 HTTP 请求', '等待应用产生网络请求。'] : state === 'noResults' ? ['没有匹配结果', '调整或清除筛选条件。'] : ['HTTP 请求加载失败', '请检查 Monitor Service 后重试。'];
  return <div className="grid h-full place-items-center p-6 text-center"><div><MoreHorizontal className="mx-auto mb-2 size-5 text-text-muted" /><p className="text-sm font-medium text-text-primary">{content[0]}</p><p className="mt-1 text-xs text-text-secondary">{content[1]}</p>{state === 'error' ? <Button className="mt-3" size="sm" onClick={onRetry}>重试</Button> : null}</div></div>;
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) { return <th className={cn('px-2 font-medium', className)}>{children}</th>; }
function Td({ children, className }: { children?: React.ReactNode; className?: string }) { return <td className={cn('overflow-hidden px-2', className)}>{children}</td>; }

function displayUrl(url: string | undefined, full: boolean): string {
  if (!url || full) return url ?? '-';
  try { const parsed = new URL(url); return `${parsed.pathname}${parsed.search}`; } catch { return url; }
}
function stateMark(state: HttpCatalogItem['businessCodeState']) { return state === 'parse_failed' ? '解析失败' : state === 'detail_unavailable' ? '详情缺失' : '-'; }
function businessCodeTitle(item: HttpCatalogItem) { return item.businessCode ?? (item.businessCodeState === 'parse_failed' ? '响应 body 无法解析为含顶层 code 的 JSON' : item.businessCodeState === 'detail_unavailable' ? '详情被剥离或 body 被截断' : '响应中没有顶层 code'); }
