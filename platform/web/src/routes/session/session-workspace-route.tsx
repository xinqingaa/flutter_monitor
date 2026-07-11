import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, GitBranch } from 'lucide-react';
import { SplitPane } from '../../components/layout/split-pane';
import { Sheet } from '../../components/ui/sheet';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { CopyableId } from '../../components/common/copyable-id';
import { JsonViewer } from '../../features/inspector/json-viewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useEventQuery, useSessionQuery } from '../../shared/datasource/queries';
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
  const selectedRef = useRef<HTMLButtonElement>(null);
  const events = useMemo(() => sortEvents(session.data ?? []).filter(inPrimaryTimeline), [session.data]);
  const selectedEvent = events.find((event) => event.eventId === search.eventId);
  const detail = useEventQuery(search.eventId);
  const visible = events.filter((event) => group === 'all' || groupOf(event) === group);
  const narrow = useMedia('(max-width: 1023px)');

  useEffect(() => { if (search.eventId) selectedRef.current?.scrollIntoView({ block: 'center' }); }, [search.eventId, visible.length]);
  function select(event: MonitorEvent) { if (!event.eventId) return; void navigate({ search: { eventId: event.eventId, traceId: event.traceId } }); }
  const record = <SessionRecord event={detail.data ?? selectedEvent} loading={detail.isLoading} />;
  return <div className="flex h-full min-h-0 flex-col bg-canvas">
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border-default bg-surface px-3"><div className="flex min-w-0 items-center gap-2"><Button asChild size="icon" variant="ghost"><a href="/" aria-label="返回大屏"><ArrowLeft /></a></Button><div className="min-w-0"><h1 className="truncate text-[15px] font-semibold">Session 链路</h1><div className="flex items-center gap-1 text-xs text-text-secondary"><GitBranch className="size-3"/><CopyableId value={sessionId}/></div></div></div><span className="text-xs tabular-nums text-text-secondary">{events.length} 个主要事件</span></header>
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border-default bg-surface px-3">{(['all','startup','page','http','business','problem'] as Group[]).map((value)=><Button key={value} size="sm" variant={group===value?'default':'ghost'} onClick={()=>setGroup(value)}>{groupLabel(value)} <span className="tabular-nums opacity-70">{value==='all'?events.length:events.filter((event)=>groupOf(event)===value).length}</span></Button>)}</div>
    {session.isLoading ? <State text="正在加载 Session"/> : session.isError ? <State text="Session 加载失败"/> : events.length===0 ? <State text="Session 中没有启动、页面、HTTP、埋点或错误事件"/> : <SplitPane storageKey="flutter-monitor.session.record-width" defaultSize={460} minSize={380} maxSize={720} primary={<div className="h-full overflow-auto bg-surface p-3"><div className="relative mx-auto grid max-w-4xl gap-1 border-l border-border-default pl-4">{visible.map((event)=><TimelineRow key={event.eventId} event={event} selected={event.eventId===search.eventId} selectedRef={event.eventId===search.eventId?selectedRef:undefined} onClick={()=>select(event)}/>)}</div></div>} secondary={record}/>} 
    {narrow ? <Sheet open={Boolean(search.eventId)} onOpenChange={(open)=>{if(!open)void navigate({search:{}})}} title={selectedEvent?.name ?? '事件详情'}>{record}</Sheet> : null}
  </div>;
}

function TimelineRow({event,selected,selectedRef,onClick}:{event:MonitorEvent;selected:boolean;selectedRef?:React.RefObject<HTMLButtonElement|null>;onClick:()=>void}){const group=groupOf(event);const issues=issueLabels(event);return <button ref={selectedRef} type="button" onClick={onClick} className={cn('relative grid min-h-14 w-full grid-cols-[90px_minmax(0,1fr)_auto] items-center gap-3 rounded-control border border-transparent px-3 py-2 text-left outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-interactive-focusRing',selected&&'border-border-selected bg-selected')}><span className={cn('absolute -left-[21px] size-2 rounded-full bg-status-neutral',issues.length&&'bg-status-danger',selected&&'size-2.5 bg-accent-default')}/><span className="font-mono text-[11px] text-text-muted">{formatDateTime(event.timestamp??event.startTime).slice(9)}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{eventTitle(event)}</span><span className="block truncate text-xs text-text-secondary">{event.status??event.signalType}{event.durationMs!==undefined?` · ${formatDuration(event.durationMs)}`:''}</span></span><Badge tone={issues.length?'danger':'neutral'}>{groupLabel(group)}</Badge></button>}
function SessionRecord({event,loading}:{event?:MonitorEvent;loading:boolean}){if(loading)return <State text="正在加载事件"/>;if(!event)return <State text="选择一个事件查看详情"/>;return <div className="grid gap-3 p-3 pt-12 text-xs"><div><div className="flex items-center gap-2"><Badge tone={issueLabels(event).length?'danger':'neutral'}>{groupLabel(groupOf(event))}</Badge><span className="text-text-secondary">{formatDateTime(event.timestamp??event.startTime)}</span></div><h2 className="mt-2 break-all text-sm font-semibold">{eventTitle(event)}</h2></div><div className="grid gap-2 border-y border-border-default py-3"><Id label="Event" value={event.eventId}/><Id label="Trace" value={event.traceId}/><Id label="Span" value={event.spanId}/></div><Tabs defaultValue="summary" className="grid gap-2"><TabsList className="w-fit"><TabsTrigger value="summary">摘要</TabsTrigger><TabsTrigger value="context">上下文</TabsTrigger><TabsTrigger value="raw">Raw</TabsTrigger></TabsList><TabsContent value="summary"><JsonViewer value={{status:event.status,durationMs:event.durationMs,attributes:event.attributes,payload:event.payload}} collapsed={2}/></TabsContent><TabsContent value="context"><JsonViewer value={{resource:event.resource,context:event.context}} collapsed={2}/></TabsContent><TabsContent value="raw"><JsonViewer value={event} collapsed={2}/></TabsContent></Tabs></div>}
function State({text}:{text:string}){return <div className="grid h-full min-h-40 place-items-center p-6 text-sm text-text-secondary">{text}</div>};function Id({label,value}:{label:string;value?:string}){return <div className="flex items-center justify-between gap-2"><span>{label}</span><CopyableId value={value}/></div>}
function inPrimaryTimeline(event:MonitorEvent){return ['startup','page','http','business','error'].includes(eventKind(event))||readPath(event,['attributes','business.result'])==='failed'}
function groupOf(event:MonitorEvent):Group{const kind=eventKind(event);if(kind==='error'||event.status==='error'&&kind!=='http'||readPath(event,['attributes','business.result'])==='failed')return'problem';if(kind==='startup')return'startup';if(kind==='page')return'page';if(kind==='http')return'http';if(kind==='business')return'business';return'all'}
function groupLabel(group:Group){return({all:'全部',startup:'启动',page:'页面',http:'HTTP',business:'埋点',problem:'问题'})[group]}
function eventTitle(event:MonitorEvent){if(eventKind(event)==='http')return `${String(readPath(event,['attributes','http.method'])??'HTTP')} ${String(readPath(event,['attributes','http.url.normalized'])??event.name)}`;return String(readPath(event,['attributes','business.action'])??readPath(event,['attributes','error.type'])??event.name??'事件')}
function useMedia(query:string){const [matches,setMatches]=useState(()=>window.matchMedia(query).matches);useEffect(()=>{const media=window.matchMedia(query);const update=()=>setMatches(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[query]);return matches}
