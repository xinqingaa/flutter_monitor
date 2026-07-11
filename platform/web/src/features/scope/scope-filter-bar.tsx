import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import type { DimensionSummary } from '../../shared/datasource/types';
import { isoToLocalInput, localInputToIso } from '../../shared/formatting/format';
type ScopeSearch = { from?: string; to?: string; userId?: string; sessionId?: string; appVersion?: string; environment?: string; route?: string };

export function ScopeFilterBar({
  search,
  dimensions,
  onPatch,
}: {
  search: ScopeSearch;
  dimensions?: DimensionSummary;
  onPatch: (patch: Partial<ScopeSearch>, resetPage?: boolean) => void;
}) {
  const [from, setFrom] = useState(isoToLocalInput(search.from));
  const [to, setTo] = useState(isoToLocalInput(search.to));
  const [userId, setUserId] = useState(search.userId ?? '');
  const [sessionId, setSessionId] = useState(search.sessionId ?? '');

  useEffect(() => setFrom(isoToLocalInput(search.from)), [search.from]);
  useEffect(() => setTo(isoToLocalInput(search.to)), [search.to]);
  useEffect(() => setUserId(search.userId ?? ''), [search.userId]);
  useEffect(() => setSessionId(search.sessionId ?? ''), [search.sessionId]);

  function commitText(key: 'userId' | 'sessionId', value: string) {
    onPatch({ [key]: value.trim() || undefined }, true);
  }

  return (
    <section aria-label="范围筛选" className="flex min-w-0 flex-wrap items-end gap-2 border-b border-border-default bg-surface px-3 py-2">
      <FilterField label="开始时间"><Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} className="h-8 w-[172px] text-xs" /></FilterField>
      <FilterField label="结束时间"><Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} className="h-8 w-[172px] text-xs" /></FilterField>
      <Button size="sm" onClick={() => onPatch({ from: localInputToIso(from), to: localInputToIso(to) }, true)}>应用时间</Button>
      <FilterField label="用户 ID"><Input value={userId} onChange={(event) => setUserId(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && commitText('userId', userId)} onBlur={() => commitText('userId', userId)} className="h-8 w-36 text-xs" placeholder="输入后回车" /></FilterField>
      <FilterField label="Session ID"><Input value={sessionId} onChange={(event) => setSessionId(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && commitText('sessionId', sessionId)} onBlur={() => commitText('sessionId', sessionId)} className="h-8 w-36 text-xs" placeholder="输入后回车" /></FilterField>
      <FilterField label="版本"><Select value={search.appVersion} placeholder="全部版本" options={options(dimensions?.appVersions)} onChange={(value) => onPatch({ appVersion: value }, true)} className="w-32" /></FilterField>
      <FilterField label="环境"><Select value={search.environment} placeholder="全部环境" options={options(dimensions?.environments)} onChange={(value) => onPatch({ environment: value }, true)} className="w-28" /></FilterField>
      <FilterField label="关联路由"><Select value={search.route} placeholder="全部路由" options={options(dimensions?.routes)} onChange={(value) => onPatch({ route: value }, true)} className="w-36" /></FilterField>
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-0.5 text-[11px] leading-4 text-text-secondary"><span>{label}</span>{children}</label>;
}

function options(items?: Array<{ value: string; count: number }>) {
  return (items ?? []).map((item) => ({ value: item.value, label: `${item.value} (${item.count})` }));
}
