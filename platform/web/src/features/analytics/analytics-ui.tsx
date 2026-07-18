import { AlertTriangle, ArrowUpRight, Network } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '../../components/ui/item';
import { Skeleton } from '../../components/ui/skeleton';
import type { AnalyticsAttentionItem } from '../../shared/datasource/types';
import { formatDateTime } from '../../shared/formatting/format';

export type QueryLike = { isLoading: boolean; isError: boolean; isFetching?: boolean };

export function AnalyticsAttentionList({
  items,
  scopeSearch = {},
  emptyTitle = '当前没有关注项',
  emptyDescription = '范围内没有需要优先处理的问题',
}: {
  items: AnalyticsAttentionItem[];
  scopeSearch?: Record<string, unknown>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!items.length) {
    return <ChartEmpty title={emptyTitle} description={emptyDescription} />;
  }

  const sorted = [...items].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.affectedSessions !== a.affectedSessions) return b.affectedSessions - a.affectedSessions;
    return Date.parse(b.timestamp ?? '') - Date.parse(a.timestamp ?? '');
  });

  return (
    <ItemGroup>
      {sorted.map((item, index) => {
        return (
          <div key={`${item.domain}-${item.eventId}-${index}`}>
            <Item asChild size="sm">
              <AttentionLink item={item} scopeSearch={scopeSearch}>
                <ItemMedia variant="icon"><AlertTriangle /></ItemMedia>
                <ItemContent>
                  <ItemTitle className="line-clamp-1">{item.title}</ItemTitle>
                  <ItemDescription>
                    {domainLabel(item.domain)}
                    {item.detail ? ` · ${item.detail}` : ''}
                    {` · ${item.count} 次 · ${item.affectedSessions} Session`}
                    {item.timestamp ? ` · ${formatDateTime(item.timestamp)}` : ''}
                  </ItemDescription>
                </ItemContent>
                <ItemActions><ArrowUpRight /></ItemActions>
              </AttentionLink>
            </Item>
            {index < sorted.length - 1 ? <ItemSeparator /> : null}
          </div>
        );
      })}
    </ItemGroup>
  );
}

function AttentionLink({ item, scopeSearch, children }: { item: AnalyticsAttentionItem; scopeSearch: Record<string, unknown>; children: ReactNode }) {
  const detailSearch = { ...scopeSearch, eventId: item.eventId, detail: item.eventId };
  if (item.domain === 'session' && item.sessionId) {
    return <Link to="/sessions/$sessionId" params={{ sessionId: item.sessionId }} search={{ ...scopeSearch, eventId: item.eventId, traceId: item.traceId }}>{children}</Link>;
  }
  if (item.domain === 'http') return <Link to="/http" search={detailSearch}>{children}</Link>;
  if (item.domain === 'business') return <Link to="/business" search={detailSearch}>{children}</Link>;
  return <Link to="/errors" search={detailSearch}>{children}</Link>;
}

export function ChartState({ query, emptyTitle = '当前范围没有数据', emptyDescription = '调整日期或其它范围条件' }: {
  query: QueryLike;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return query.isLoading
    ? <ChartLoading />
    : query.isError
      ? <ChartEmpty title="图表加载失败" description="请检查服务后重试" danger />
      : <ChartEmpty title={emptyTitle} description={emptyDescription} />;
}

export function ChartLoading() {
  return <div className="flex h-64 flex-col gap-4"><Skeleton className="h-4 w-32" /><Skeleton className="w-full flex-1" /></div>;
}

export function ChartEmpty({ title, description, danger }: { title: string; description: string; danger?: boolean }) {
  return (
    <Empty className="h-64 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">{danger ? <AlertTriangle className="text-destructive" /> : <Network />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function cleanSearchRecord<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (Array.isArray(item)) return item.length > 0;
      return item !== undefined && item !== '';
    }),
  ) as T;
}

function domainLabel(domain: AnalyticsAttentionItem['domain']) {
  switch (domain) {
    case 'http': return 'HTTP';
    case 'business': return '埋点';
    case 'error': return '异常';
    case 'session': return 'Session';
    default: return domain;
  }
}
