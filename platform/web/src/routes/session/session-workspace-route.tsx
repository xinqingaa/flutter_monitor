import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { AlertTriangle, AppWindow, GitBranch, MousePointerClick, Network, Rocket } from 'lucide-react';
import { Badge } from '../../components/common/status-badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import { IdCombobox } from '../../components/common/id-combobox';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '../../components/ui/item';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { CopyableId } from '../../components/common/copyable-id';
import { JsonViewer } from '../../features/inspector/json-viewer';
import { useDebouncedValue } from '../../shared/hooks/use-debounced-value';
import { useDimensionsQuery, useEventQuery, useSessionQuery } from '../../shared/datasource/queries';
import type { MonitorEvent } from '../../shared/datasource/types';
import { eventKind, issueLabels, readPath, sortEvents } from '../../shared/event-model/accessors';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';
import { cn } from '../../shared/formatting/cn';

type Group = 'all' | 'startup' | 'page' | 'http' | 'business' | 'problem';

export function SessionWorkspaceRoute() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId' });
  const search = useSearch({ from: '/sessions/$sessionId' });
  const navigate = useNavigate({ from: '/sessions/$sessionId' });
  const session = useSessionQuery(sessionId);
  const [group, setGroup] = useState<Group>('all');
  const [sessionQuery, setSessionQuery] = useState(sessionId);
  const debouncedSession = useDebouncedValue(sessionQuery, 250);
  const suggestions = useDimensionsQuery({}, debouncedSession);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const events = useMemo(() => sortEvents(session.data ?? []).filter(inPrimaryTimeline), [session.data]);
  const visible = events.filter((event) => group === 'all' || groupOf(event) === group);
  const selectedEvent = events.find((event) => event.eventId === search.eventId);
  const detail = useEventQuery(search.eventId);
  const narrow = useMedia('(max-width: 899px)');
  const first = events[0];
  const last = events.at(-1);
  const userId = stringValue(readPath(first, ['context', 'user', 'userId']));
  const appVersion = stringValue(readPath(first, ['resource', 'app', 'appVersion']));
  const problemCount = events.filter((event) => groupOf(event) === 'problem').length;

  useEffect(() => { setSessionQuery(sessionId); }, [sessionId]);
  useEffect(() => { if (search.eventId) selectedRef.current?.scrollIntoView({ block: 'center' }); }, [search.eventId, visible.length]);
  function select(event: MonitorEvent) { if (event.eventId) void navigate({ search: { eventId: event.eventId, traceId: event.traceId } }); }
  function switchSession(next?: string) { if (!next || next === sessionId) return; void navigate({ to: '/sessions/$sessionId', params: { sessionId: next }, search: {} }); }
  const record = <SessionRecord event={detail.data ?? selectedEvent} loading={detail.isLoading} />;

  return <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-canvas">
    <section className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border-default bg-surface px-3 py-2">
      <IdCombobox value={sessionId} label="Session ID" query={sessionQuery} options={suggestions.data?.sessionIds ?? []} loading={suggestions.isFetching} error={suggestions.isError} onQueryChange={setSessionQuery} onChange={switchSession} className="w-64" />
      <Summary label="时间" value={`${formatDateTime(first?.timestamp ?? first?.startTime)} - ${formatDateTime(last?.timestamp ?? last?.endTime)}`} />
      <Summary label="用户" value={userId ?? '-'} mono />
      <Summary label="版本" value={appVersion ?? '-'} />
      <Badge tone={problemCount ? 'danger' : 'neutral'}>{problemCount} 个问题</Badge>
    </section>
    {session.isLoading ? <SessionEmpty title="正在加载 Session" description="读取事件链路与上下文" /> : session.isError ? <SessionEmpty title="Session 加载失败" description="请检查 Monitor Service 后重试" danger /> : events.length === 0 ? <SessionEmpty title="没有主要事件" description="当前 Session 中没有启动、页面、HTTP、埋点或错误事件" /> : narrow ? <MobileWorkspace group={group} setGroup={setGroup} events={events} visible={visible} selectedId={search.eventId} selectedRef={selectedRef} onSelect={select} record={record} onClose={() => void navigate({ search: {} })} /> : <ResizablePanelGroup orientation="horizontal" className="min-h-0 bg-surface">
      <ResizablePanel defaultSize={58} minSize={40}><EventBrowser group={group} setGroup={setGroup} events={events} visible={visible} selectedId={search.eventId} selectedRef={selectedRef} onSelect={select} /></ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={42} minSize={30}><div className="h-full min-h-0 border-l border-border-default bg-surface">{record}</div></ResizablePanel>
    </ResizablePanelGroup>}
  </div>;
}

function EventBrowser({ group, setGroup, events, visible, selectedId, selectedRef, onSelect }: { group: Group; setGroup: (group: Group) => void; events: MonitorEvent[]; visible: MonitorEvent[]; selectedId?: string; selectedRef: React.RefObject<HTMLButtonElement | null>; onSelect: (event: MonitorEvent) => void }) {
  return <Tabs value={group} onValueChange={(value) => setGroup(value as Group)} className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
    <ScrollArea className="border-b border-border-default"><div className="w-max px-3 py-2"><TabsList>{groups.map((value) => <TabsTrigger key={value} value={value}>{groupLabel(value)} <span className="ml-1 tabular-nums opacity-60">{value === 'all' ? events.length : events.filter((event) => groupOf(event) === value).length}</span></TabsTrigger>)}</TabsList></div></ScrollArea>
    <TabsContent value={group} className="min-h-0 overflow-hidden"><ScrollArea className="h-full"><ItemGroup className="p-2">{visible.map((event) => <EventItem key={event.eventId} event={event} selected={event.eventId === selectedId} selectedRef={event.eventId === selectedId ? selectedRef : undefined} onClick={() => onSelect(event)} />)}</ItemGroup></ScrollArea></TabsContent>
  </Tabs>;
}

function EventItem({ event, selected, selectedRef, onClick }: { event: MonitorEvent; selected: boolean; selectedRef?: React.RefObject<HTMLButtonElement | null>; onClick: () => void }) { const group = groupOf(event); const issues = issueLabels(event); const Icon = groupIcon(group); const timestamp = event.timestamp ?? event.startTime; return <Item asChild size="sm" variant={selected ? 'outline' : 'default'} className={cn('w-full cursor-pointer rounded-md text-left hover:bg-accent/50', selected && 'border-border-selected bg-selected')}><button ref={selectedRef} type="button" onClick={onClick}><ItemMedia variant="icon"><Icon className={issues.length ? 'text-status-danger' : 'text-text-secondary'} /></ItemMedia><ItemContent><ItemTitle className="max-w-full truncate">{eventTitle(event)}</ItemTitle><ItemDescription className="flex flex-wrap gap-x-2 text-xs"><span title={timestamp}>{formatDateTime(timestamp)}</span><span>{event.status ?? event.signalType}</span>{event.durationMs !== undefined ? <span>{formatDuration(event.durationMs)}</span> : null}</ItemDescription></ItemContent><ItemActions><Badge tone={issues.length ? 'danger' : 'neutral'}>{groupLabel(group)}</Badge></ItemActions></button></Item> }

function MobileWorkspace(props: Parameters<typeof EventBrowser>[0] & { record: React.ReactNode; onClose: () => void }) { return <><EventBrowser {...props} /><Sheet open={Boolean(props.selectedId)} onOpenChange={(open) => !open && props.onClose()}><SheetContent className="w-full p-0"><SheetHeader className="border-b p-4"><SheetTitle>事件详情</SheetTitle></SheetHeader>{props.record}</SheetContent></Sheet></>; }
function SessionRecord({ event, loading }: { event?: MonitorEvent; loading: boolean }) { if (loading) return <SessionEmpty title="正在加载事件" description="读取原始 EventEnvelope" />; if (!event) return <SessionEmpty title="选择一个事件" description="从左侧事件流查看摘要、上下文和 Raw" />; return <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]"><div className="border-b border-border-default p-3"><div className="flex items-center gap-2"><Badge tone={issueLabels(event).length ? 'danger' : 'neutral'}>{groupLabel(groupOf(event))}</Badge><span className="text-xs text-text-secondary">{formatDateTime(event.timestamp ?? event.startTime)}</span></div><h2 className="mt-2 break-all text-sm font-semibold">{eventTitle(event)}</h2><div className="mt-2 flex flex-wrap gap-3 text-xs"><Id label="Event" value={event.eventId} /><Id label="Trace" value={event.traceId} /><Id label="Span" value={event.spanId} /></div></div><Tabs defaultValue="summary" className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3"><TabsList className="w-fit"><TabsTrigger value="summary">摘要</TabsTrigger><TabsTrigger value="context">上下文</TabsTrigger><TabsTrigger value="raw">Raw</TabsTrigger></TabsList><TabsContent value="summary" className="min-h-0 overflow-auto"><JsonViewer value={{ status: event.status, durationMs: event.durationMs, attributes: event.attributes, payload: event.payload }} collapsed={2} /></TabsContent><TabsContent value="context" className="min-h-0 overflow-auto"><JsonViewer value={{ resource: event.resource, context: event.context }} collapsed={2} /></TabsContent><TabsContent value="raw" className="min-h-0 overflow-auto"><JsonViewer value={event} collapsed={2} /></TabsContent></Tabs></div> }
function SessionEmpty({ title, description, danger }: { title: string; description: string; danger?: boolean }) { return <Empty className="h-full border-0"><EmptyHeader><EmptyMedia variant="icon">{danger ? <AlertTriangle className="text-status-danger" /> : <GitBranch />}</EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader></Empty>; }
function Summary({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <div className="min-w-0 text-xs"><span className="text-text-muted">{label}</span><div className={cn('max-w-72 truncate text-text-primary', mono && 'font-mono')}>{value}</div></div>; }
function Id({ label, value }: { label: string; value?: string }) { return <span className="inline-flex items-center gap-1 text-text-secondary"><span>{label}</span><CopyableId value={value} /></span>; }

const groups: Group[] = ['all', 'startup', 'page', 'http', 'business', 'problem'];
function inPrimaryTimeline(event: MonitorEvent) { return ['startup', 'page', 'http', 'business', 'error'].includes(eventKind(event)) || readPath(event, ['attributes', 'business.result']) === 'failed'; }
function groupOf(event: MonitorEvent): Group { const kind = eventKind(event); if (kind === 'error' || (event.status === 'error' && kind !== 'http') || readPath(event, ['attributes', 'business.result']) === 'failed') return 'problem'; if (kind === 'startup') return 'startup'; if (kind === 'page') return 'page'; if (kind === 'http') return 'http'; if (kind === 'business') return 'business'; return 'all'; }
function groupLabel(group: Group) { return ({ all: '全部', startup: '启动', page: '页面', http: 'HTTP', business: '埋点', problem: '问题' })[group]; }
function groupIcon(group: Group) { return group === 'startup' ? Rocket : group === 'page' ? AppWindow : group === 'http' ? Network : group === 'business' ? MousePointerClick : group === 'problem' ? AlertTriangle : GitBranch; }
function eventTitle(event: MonitorEvent) { if (eventKind(event) === 'http') return `${String(readPath(event, ['attributes', 'http.method']) ?? 'HTTP')} ${String(readPath(event, ['attributes', 'http.url.normalized']) ?? event.name)}`; return String(readPath(event, ['attributes', 'business.action']) ?? readPath(event, ['attributes', 'error.type']) ?? event.name ?? '事件'); }
function stringValue(value: unknown) { return typeof value === 'string' ? value : undefined; }
function useMedia(query: string) { const [matches, setMatches] = useState(() => window.matchMedia(query).matches); useEffect(() => { const media = window.matchMedia(query); const update = () => setMatches(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, [query]); return matches; }
