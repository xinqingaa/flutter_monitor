import { ExternalLink, GitBranch, MoreHorizontal } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '../../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
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
    <div className="h-full overflow-auto">
      {state === 'partial' ? <div className="border-b bg-muted px-4 py-2 text-sm text-muted-foreground">部分 HTTP 详情已被剥离，列表事实字段仍可查询。</div> : null}
      <Table className="min-w-[860px] table-fixed">
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-[160px]">时间</TableHead><TableHead className="w-[76px]">方法</TableHead><TableHead>URL</TableHead><TableHead className="w-[88px] text-right">状态码</TableHead><TableHead className="w-[96px] text-right">业务码</TableHead><TableHead className="w-[92px] text-right">耗时</TableHead><TableHead className="w-[140px]">关联路由</TableHead><TableHead className="w-[52px]" />
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
                data-state={item.eventId === selectedId ? 'selected' : undefined}
                className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onSelect(item)}
                onDoubleClick={() => onOpen(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onOpen(item);
                  if (event.key === ' ') { event.preventDefault(); onSelect(item); }
                }}
              >
                <TableCell className="overflow-hidden font-mono text-xs text-muted-foreground" title={item.timestamp}>{formatTime(item.timestamp)}</TableCell>
                <TableCell className="overflow-hidden font-mono font-medium">{item.method ?? '-'}</TableCell>
                <TableCell className="overflow-hidden"><span title={item.url} className="block truncate font-mono text-xs">{displayUrl(item.url, fullUrl)}</span></TableCell>
                <TableCell className={cn('overflow-hidden text-right font-mono tabular-nums', failed && 'font-medium text-destructive')}>{item.statusCode ?? '-'}</TableCell>
                <TableCell className="overflow-hidden text-right font-mono tabular-nums"><span title={businessCodeTitle(item)}>{item.businessCode ?? stateMark(item.businessCodeState)}</span></TableCell>
                <TableCell className={cn('overflow-hidden text-right font-mono tabular-nums', slow && 'font-medium')}>{formatDuration(item.durationMs)}</TableCell>
                <TableCell className="overflow-hidden"><span className="block truncate" title={item.route}>{item.route ?? '-'}</span></TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="HTTP 行操作"><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuItem onSelect={() => onOpen(item)}><ExternalLink />打开详情</DropdownMenuItem>{item.sessionId ? <DropdownMenuItem asChild><Link to="/sessions/$sessionId" params={{ sessionId: item.sessionId }} search={{ eventId: item.eventId }}><GitBranch />查看 Session</Link></DropdownMenuItem> : null}</DropdownMenuGroup></DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
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
  return <Empty className="h-full border-0"><EmptyHeader><EmptyMedia variant="icon"><MoreHorizontal /></EmptyMedia><EmptyTitle>{content[0]}</EmptyTitle><EmptyDescription>{content[1]}</EmptyDescription>{state === 'error' ? <Button size="sm" onClick={onRetry}>重试</Button> : null}</EmptyHeader></Empty>;
}

function displayUrl(url: string | undefined, full: boolean): string {
  if (!url || full) return url ?? '-';
  try { const parsed = new URL(url); return `${parsed.pathname}${parsed.search}`; } catch { return url; }
}
function stateMark(state: HttpCatalogItem['businessCodeState']) { return state === 'parse_failed' ? '解析失败' : state === 'detail_unavailable' ? '详情缺失' : '-'; }
function businessCodeTitle(item: HttpCatalogItem) { return item.businessCode ?? (item.businessCodeState === 'parse_failed' ? '响应 body 无法解析为含顶层 code 的 JSON' : item.businessCodeState === 'detail_unavailable' ? '详情被剥离或 body 被截断' : '响应中没有顶层 code'); }
