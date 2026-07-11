import { useNavigate, useSearch } from '@tanstack/react-router';
import { AlertTriangle, Gauge, MousePointerClick, Network, Radio, Rocket } from 'lucide-react';
import { ScopeFilterBar } from '../../features/scope/scope-filter-bar';
import { useBusinessCatalogQuery, useDimensionsQuery, useErrorCatalogQuery, useHttpCatalogQuery, usePerformanceQuery } from '../../shared/datasource/queries';
import type { SessionFilters } from '../../shared/datasource/types';
import { formatDuration, formatTime } from '../../shared/formatting/format';
import { Badge } from '../../components/ui/badge';

export function DashboardRoute() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const scope = scopeQuery(search);
  const dimensions = useDimensionsQuery(scope);
  const performance = usePerformanceQuery({ ...scope, limit: 80 });
  const business = useBusinessCatalogQuery({ ...scope, limit: 1, offset: 0 });
  const businessFailed = useBusinessCatalogQuery({ ...scope, result: ['failed'], limit: 1, offset: 0 });
  const errors = useErrorCatalogQuery({ ...scope, limit: 6, offset: 0 });
  const failedHttp = useHttpCatalogQuery({ ...scope, result: 'failed', limit: 6, offset: 0 });
  const overview = performance.data;
  const startupTarget = overview?.startup.events.find((event) => event.sessionId && event.eventId);
  return <div className="h-full overflow-auto bg-canvas">
    <header className="flex h-14 items-center justify-between border-b border-border-default bg-surface px-4"><div><h1 className="text-[15px] font-semibold text-text-primary">大屏</h1><p className="text-xs text-text-secondary">当前范围内的质量概况</p></div><span className="inline-flex items-center gap-1 text-xs text-text-secondary"><Radio className="size-3.5 text-status-success" />Live</span></header>
    <ScopeFilterBar search={search} dimensions={dimensions.data} onPatch={(patch) => void navigate({ search: (current) => clean({ ...current, ...patch }) })} />
    <div className="mx-auto grid max-w-[1440px] gap-4 p-4">
      <section className="grid overflow-hidden rounded-panel border border-border-default bg-surface md:grid-cols-2 xl:grid-cols-4">
        <MetricLink href={startupTarget ? `/sessions/${encodeURIComponent(startupTarget.sessionId!)}?eventId=${encodeURIComponent(startupTarget.eventId!)}` : undefined} icon={Rocket} label="启动" value={overview?.startup.count ?? 0} detail={`平均 ${formatDuration(overview?.startup.coldStart.averageMs)} · 最慢 ${formatDuration(overview?.startup.coldStart.maxMs)}`} />
        <MetricLink href={href('/http', search, overview?.http.failedCount ? { result: 'failed' } : {})} icon={Network} label="HTTP" value={overview?.http.count ?? 0} detail={`${overview?.http.failedCount ?? 0} 失败 · ${overview?.http.slowCount ?? 0} 慢请求`} />
        <MetricLink href={href('/business', search, businessFailed.data?.total ? { result: 'failed' } : {})} icon={MousePointerClick} label="埋点" value={business.data?.total ?? 0} detail={`${businessFailed.data?.total ?? 0} 个失败动作`} />
        <MetricLink href={href('/errors', search)} icon={AlertTriangle} label="异常" value={errors.data?.total ?? 0} detail={`${overview?.errors.affectedSessionCount ?? 0} 个受影响 Session`} danger={Boolean(errors.data?.total)} />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <ProblemList title="最近失败 HTTP" icon={Network} empty="当前范围没有失败 HTTP" items={(failedHttp.data?.items ?? []).map((item) => ({ id: item.eventId, title: `${item.method ?? 'HTTP'} ${pathOnly(item.url)}`, meta: `${item.statusCode ?? '失败'} · ${formatDuration(item.durationMs)} · ${formatTime(item.timestamp)}`, href: `/http?eventId=${encodeURIComponent(item.eventId)}&detail=${encodeURIComponent(item.eventId)}` }))} />
        <ProblemList title="最近异常与业务失败" icon={AlertTriangle} empty="当前范围没有异常" items={(errors.data?.items ?? []).map((item) => ({ id: item.eventId, title: item.message ?? item.type, meta: `${item.kind === 'business_failure' ? '业务失败' : item.type} · ${formatTime(item.timestamp)}`, href: `/errors?eventId=${encodeURIComponent(item.eventId)}&detail=${encodeURIComponent(item.eventId)}` }))} />
      </section>
    </div>
  </div>;
}

function MetricLink({ href, icon: Icon, label, value, detail, danger }: { href?: string; icon: typeof Gauge; label: string; value: number; detail: string; danger?: boolean }) {
  const content = <div className="grid min-h-28 content-between gap-3 border-b border-r border-border-default p-4 last:border-r-0 xl:border-b-0"><div className="flex items-center justify-between"><span className="text-sm font-medium text-text-secondary">{label}</span><Icon className={danger ? 'size-4 text-status-danger' : 'size-4 text-text-muted'} /></div><div><div className={danger ? 'text-2xl font-semibold tabular-nums text-status-danger' : 'text-2xl font-semibold tabular-nums text-text-primary'}>{value}</div><p className="mt-1 text-xs text-text-secondary">{detail}</p></div></div>;
  return href ? <a href={href}>{content}</a> : <div aria-disabled="true">{content}</div>;
}
function ProblemList({ title, icon: Icon, items, empty }: { title:string; icon:typeof Gauge; items:Array<{id:string;title:string;meta:string;href:string}>; empty:string }) { return <section className="overflow-hidden rounded-panel border border-border-default bg-surface"><header className="flex h-11 items-center gap-2 border-b border-border-default px-3"><Icon className="size-4 text-text-secondary"/><h2 className="text-sm font-semibold">{title}</h2><Badge tone={items.length ? 'danger' : 'neutral'}>{items.length}</Badge></header>{items.length ? <div>{items.map((item)=><a key={item.id} href={item.href} className="block border-b border-border-muted px-3 py-2 last:border-0 hover:bg-subtle"><div className="truncate text-sm font-medium text-text-primary">{item.title}</div><div className="mt-0.5 text-xs text-text-secondary">{item.meta}</div></a>)}</div> : <div className="grid min-h-32 place-items-center text-sm text-text-muted">{empty}</div>}</section>; }
function scopeQuery(search: Record<string,unknown>): SessionFilters { const list=(value:unknown)=>typeof value==='string'?value.split(',').filter(Boolean):undefined; return {appKey:list(search.appKey),environment:list(search.environment),appVersion:list(search.appVersion),devicePlatform:list(search.devicePlatform),from:typeof search.from==='string'?search.from:undefined,to:typeof search.to==='string'?search.to:undefined,userId:typeof search.userId==='string'?search.userId:undefined,sessionId:typeof search.sessionId==='string'?search.sessionId:undefined,route:list(search.route)}; }
function pathOnly(url?:string){if(!url)return '未知 URL';try{return new URL(url).pathname}catch{return url}}
function href(path:string,search:Record<string,unknown>,extra:Record<string,unknown>={}){const params=new URLSearchParams();for(const [key,value] of Object.entries({...search,...extra})){if(value!==undefined&&value!=='')params.set(key,String(value))}return `${path}${params.size?`?${params}`:''}`}
function clean<T extends Record<string,unknown>>(value:T):T{return Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined&&item!=='')) as T}
