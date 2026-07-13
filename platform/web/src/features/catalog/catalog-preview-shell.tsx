import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ExternalLink, GitBranch } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../components/ui/empty';
import { Separator } from '../../components/ui/separator';
import { CopyableId } from '../../components/common/copyable-id';

export interface CatalogPreviewFact {
  label: string;
  value: ReactNode;
}

export interface CatalogPreviewId {
  label: string;
  value?: string;
}

export function CatalogPreviewShell({
  selected,
  loading,
  error,
  emptyDescription,
  header,
  notice,
  facts,
  ids,
  eventId,
  sessionId,
  onOpen,
}: {
  selected: boolean;
  loading?: boolean;
  error?: boolean;
  emptyDescription: string;
  header?: ReactNode;
  notice?: ReactNode;
  facts?: CatalogPreviewFact[];
  ids?: CatalogPreviewId[];
  eventId?: string;
  sessionId?: string;
  onOpen: () => void;
}) {
  if (loading) return <PreviewMessage title="正在加载摘要" description={emptyDescription} />;
  if (error) return <PreviewMessage title="摘要加载失败" description="请检查数据查询状态后重试。" />;
  if (!selected) return <PreviewMessage title="选择一行查看摘要" description={emptyDescription} />;

  return (
    <div className="flex flex-col gap-5 p-6 text-sm">
      {header}
      {notice}
      {facts?.length ? (
        <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-3">
          {facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="min-w-0 truncate text-right font-medium tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {ids?.length ? <Separator /> : null}
      {ids?.length ? (
        <section className="grid gap-3">
          {ids.map((id) => (
            <div key={id.label} className="flex min-w-0 items-center justify-between gap-2">
              <span className="text-muted-foreground">{id.label}</span>
              <CopyableId value={id.value} />
            </div>
          ))}
        </section>
      ) : null}
      <div className="grid gap-2">
        <Button onClick={onOpen}><ExternalLink data-icon="inline-start" />打开详情</Button>
        {sessionId && eventId ? (
          <Button variant="outline" asChild>
            <Link to="/sessions/$sessionId" params={{ sessionId }} search={{ eventId }}>
              <GitBranch data-icon="inline-start" />查看 Session
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PreviewMessage({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
