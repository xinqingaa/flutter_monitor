import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, GitBranch, Terminal } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { useToast } from '../../components/common/toast';
import {
  copyHttpCurl,
  HttpRecordContent,
  HttpRecordSummary,
  httpSummaryFromEvent,
  pathOnly,
} from '../../features/inspector/http-record';
import { pickScopeSearch } from '../../features/scope/scope-filters';
import { useEventQuery } from '../../shared/datasource/queries';

export function HttpDetailRoute() {
  const { eventId } = useParams({ from: '/http/$eventId' });
  const navigate = useNavigate();
  const detail = useEventQuery(eventId);
  const { showToast } = useToast();
  const event = detail.data;
  const summary = event ? httpSummaryFromEvent(event) : undefined;
  const failed = summary?.success === false || event?.status === 'error';

  async function copyCurl() {
    try {
      await copyHttpCurl({ item: summary, event });
      showToast({ tone: 'success', title: '已复制 cURL' });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '当前 HTTP 事件缺少 URL，无法生成 cURL。' });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <section className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="返回列表"
            onClick={() => void navigate({ to: '/http', search: (current) => pickScopeSearch(current) })}
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              {summary ? `${summary.method ?? 'HTTP'} ${pathOnly(summary.url)}` : 'HTTP 详情'}
            </h2>
            <p className="truncate font-mono text-xs text-muted-foreground">{summary?.url ?? eventId}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void copyCurl()} disabled={!summary?.url}>
            <Terminal data-icon="inline-start" />
            复制 cURL
          </Button>
          {summary?.sessionId ? (
            <Button size="sm" variant="outline" asChild>
              <Link
                to="/sessions/$sessionId"
                params={{ sessionId: summary.sessionId }}
                search={{ eventId, traceId: summary.traceId }}
              >
                <GitBranch data-icon="inline-start" />
                查看 Session
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      {summary ? (
        <>
          <div className="shrink-0 border-b px-4 py-4">
            <HttpRecordSummary item={summary} />
          </div>
          <Separator />
        </>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <HttpRecordContent
          event={event}
          loading={detail.isLoading}
          error={detail.isError}
          failed={failed}
        />
      </div>
    </div>
  );
}
