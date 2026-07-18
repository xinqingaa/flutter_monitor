import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { DomainRecordContent } from './domain-catalog-route';
import { pickScopeSearch } from '../../features/scope/scope-filters';
import { useEventQuery } from '../../shared/datasource/queries';
import { readPath } from '../../shared/event-model/accessors';
import { formatDateTime } from '../../shared/formatting/format';
import { resultFilterLabel } from '../../shared/formatting/filter-labels';

export function BusinessDetailRoute() {
  return <DomainDetailRoute mode="business" />;
}

export function ErrorDetailRoute() {
  return <DomainDetailRoute mode="errors" />;
}

function DomainDetailRoute({ mode }: { mode: 'business' | 'errors' }) {
  const listPath = mode === 'business' ? '/business' : '/errors';
  const paramRoute = mode === 'business' ? '/business/$eventId' : '/errors/$eventId';
  const { eventId } = useParams({ from: paramRoute });
  const navigate = useNavigate();
  const detail = useEventQuery(eventId);
  const event = detail.data;
  const action = stringValue(readPath(event, ['attributes', 'business.action']));
  const result = stringValue(readPath(event, ['attributes', 'business.result']));
  const errorType = stringValue(readPath(event, ['attributes', 'error.type'])) ?? event?.name;
  const title = mode === 'business' ? (action ?? '埋点详情') : (errorType ?? '异常详情');

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <section className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="返回列表"
            onClick={() => void navigate({ to: listPath, search: (current) => pickScopeSearch(current) })}
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <p className="truncate font-mono text-xs text-muted-foreground">{eventId}</p>
          </div>
        </div>
        {event?.sessionId ? (
          <Button size="sm" variant="outline" asChild>
            <Link
              to="/sessions/$sessionId"
              params={{ sessionId: event.sessionId }}
              search={{ eventId, traceId: event.traceId }}
            >
              <GitBranch data-icon="inline-start" />
              查看 Session
            </Link>
          </Button>
        ) : null}
      </section>

      {event ? (
        <>
          <div className="shrink-0 border-b px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'business' ? (
                <Badge variant={result === 'failed' ? 'destructive' : 'secondary'}>{resultFilterLabel(result)}</Badge>
              ) : (
                <Badge variant={event.signalType === 'error' ? 'destructive' : 'secondary'}>
                  {event.signalType === 'error' ? '异常' : '业务失败'}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDateTime(event.timestamp)} · {stringValue(readPath(event, ['context', 'route', 'name'])) ?? '-'}
              </span>
            </div>
          </div>
          <Separator />
        </>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <DomainRecordContent
          mode={mode}
          event={event}
          loading={detail.isLoading}
          error={detail.isError}
        />
      </div>
    </div>
  );
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}
