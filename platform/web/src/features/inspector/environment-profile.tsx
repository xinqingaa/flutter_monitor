import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { CopyableId } from '../../components/common/copyable-id';
import type { MonitorEvent } from '../../shared/datasource/types';
import { readPath, stringPath } from '../../shared/event-model/accessors';
import { cn } from '../../shared/formatting/cn';

type FactValue = string | number | boolean | undefined | null;
type Fact = { label: string; value: FactValue };

export function EnvironmentProfile({
  event,
  className,
}: {
  event: MonitorEvent;
  className?: string;
}) {
  const missing = readPath(event, ['context', 'missing']) === true;
  const missingReason = stringPath(event, ['context', 'missingReason']);
  const featureFlags = stringArray(readPath(event, ['context', 'release', 'featureFlags']));
  const userTags = stringArray(readPath(event, ['context', 'user', 'userTags']));
  const routeStack = stringArray(readPath(event, ['context', 'route', 'stack']));
  const experiments = objectEntries(readPath(event, ['context', 'release', 'experiments']));

  const groups = [
    {
      key: 'user',
      title: '用户',
      facts: [
        { label: '用户', value: stringPath(event, ['context', 'user', 'userId']) },
        { label: '用户类型', value: stringPath(event, ['context', 'user', 'userType']) },
        { label: '分群', value: stringPath(event, ['context', 'user', 'cohort']) },
      ] satisfies Fact[],
      extra: userTags.length ? <ChipRow label="标签" values={userTags} /> : null,
    },
    {
      key: 'route',
      title: '页面',
      facts: [
        { label: '路由', value: stringPath(event, ['context', 'route', 'name']) },
        { label: '完整路由', value: stringPath(event, ['context', 'route', 'fullName']) },
        { label: '来源', value: stringPath(event, ['context', 'route', 'source']) },
      ] satisfies Fact[],
      extra: routeStack.length ? (
        <div className="grid gap-1.5">
          <span className="text-muted-foreground">路由栈</span>
          <ol className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs leading-6">
            {routeStack.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ol>
        </div>
      ) : null,
    },
    {
      key: 'module',
      title: '业务上下文',
      facts: [
        { label: '模块', value: stringPath(event, ['context', 'module', 'name']) },
        { label: '场景', value: stringPath(event, ['context', 'module', 'scene']) },
      ] satisfies Fact[],
    },
    {
      key: 'release',
      title: '发布',
      facts: [
        { label: '发布批次', value: stringPath(event, ['context', 'release', 'releaseId']) },
      ] satisfies Fact[],
      extra: featureFlags.length || experiments.length ? (
        <>
          {featureFlags.length ? <ChipRow label="Feature Flags" values={featureFlags} /> : null}
          {experiments.length ? (
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">实验</span>
              <ul className="grid gap-1 text-sm">
                {experiments.map(([name, group]) => (
                  <li key={name} className="flex justify-between gap-3">
                    <span className="truncate text-muted-foreground">{name}</span>
                    <span className="shrink-0 font-medium">{group}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null,
    },
    {
      key: 'network',
      title: '网络',
      facts: [
        { label: '网络类型', value: stringPath(event, ['context', 'network', 'type']) },
        { label: '弱网', value: boolLabel(readPath(event, ['context', 'network', 'isWeakNetwork'])) },
      ] satisfies Fact[],
    },
    {
      key: 'lifecycle',
      title: '生命周期',
      facts: [
        { label: '状态', value: stringPath(event, ['context', 'lifecycle', 'state']) },
        { label: '上一状态', value: stringPath(event, ['context', 'lifecycle', 'previousState']) },
        { label: '前台', value: boolLabel(readPath(event, ['context', 'lifecycle', 'isForeground'])) },
      ] satisfies Fact[],
    },
    {
      key: 'native',
      title: 'Native',
      facts: [
        { label: '可用', value: boolLabel(readPath(event, ['context', 'native', 'available'])) },
        { label: '平台', value: stringPath(event, ['context', 'native', 'platform']) },
        { label: '信号来源', value: stringPath(event, ['context', 'native', 'signalSource']) },
        { label: 'Bridge 版本', value: stringPath(event, ['context', 'native', 'bridgeVersion']) },
        { label: '进程 ID', value: numberLabel(readPath(event, ['context', 'native', 'processId'])) },
      ] satisfies Fact[],
    },
    {
      key: 'app',
      title: '应用',
      facts: [
        { label: 'App Key', value: stringPath(event, ['resource', 'app', 'appKey']) },
        { label: '应用名', value: stringPath(event, ['resource', 'app', 'appName']) },
        { label: '版本', value: stringPath(event, ['resource', 'app', 'appVersion']) },
        { label: '构建号', value: stringPath(event, ['resource', 'app', 'buildNumber']) },
        { label: '包名', value: stringPath(event, ['resource', 'app', 'packageName']) },
        { label: '环境', value: stringPath(event, ['resource', 'app', 'environment']) },
        { label: '渠道', value: stringPath(event, ['resource', 'app', 'channel']) },
        { label: 'Flavor', value: stringPath(event, ['resource', 'app', 'flavor']) },
      ] satisfies Fact[],
    },
    {
      key: 'device',
      title: '设备',
      facts: [
        { label: '平台', value: stringPath(event, ['resource', 'device', 'platform']) },
        { label: '厂商', value: stringPath(event, ['resource', 'device', 'manufacturer']) },
        { label: '型号', value: stringPath(event, ['resource', 'device', 'model']) },
        { label: '系统版本', value: stringPath(event, ['resource', 'device', 'osVersion']) },
        { label: '设备等级', value: stringPath(event, ['resource', 'device', 'deviceTier']) },
        { label: '刷新率', value: refreshRateLabel(readPath(event, ['resource', 'device', 'refreshRate'])) },
        { label: '真机', value: boolLabel(readPath(event, ['resource', 'device', 'isPhysicalDevice'])) },
      ] satisfies Fact[],
    },
    {
      key: 'runtime',
      title: '运行时',
      facts: [
        { label: 'Dart', value: stringPath(event, ['resource', 'runtime', 'dartVersion']) },
        { label: 'Flutter', value: stringPath(event, ['resource', 'runtime', 'flutterVersion']) },
        { label: 'Debug', value: boolLabel(readPath(event, ['resource', 'runtime', 'isDebug'])) },
      ] satisfies Fact[],
    },
    {
      key: 'sdk',
      title: 'SDK',
      facts: [
        { label: '名称', value: stringPath(event, ['resource', 'sdk', 'name']) },
        { label: 'SDK 版本', value: stringPath(event, ['resource', 'sdk', 'version']) },
        { label: 'Core 版本', value: stringPath(event, ['resource', 'sdk', 'coreVersion']) },
        { label: 'Native 版本', value: stringPath(event, ['resource', 'sdk', 'nativeVersion']) },
      ] satisfies Fact[],
    },
  ].filter((group) => group.facts.some((fact) => hasValue(fact.value)) || hasRenderable(group.extra));

  return (
    <div className={cn('flex flex-col pb-2', className)}>
      {missing ? (
        <Alert className="mb-4">
          <AlertCircle />
          <AlertTitle>上下文缺失</AlertTitle>
          <AlertDescription>{missingReason ?? '该事件上报时未能关联完整 context。'}</AlertDescription>
        </Alert>
      ) : null}

      {groups.map((group, index) => (
        <section
          key={group.key}
          className={cn('grid gap-3 py-4', index < groups.length && 'border-b border-border/60')}
        >
          <h3 className="text-sm font-semibold">{group.title}</h3>
          <FactList facts={group.facts} />
          {group.extra}
        </section>
      ))}

      <section className="grid gap-3 py-4">
        <h3 className="text-sm font-semibold">链路 ID</h3>
        <div className="grid gap-2">
          <IdRow label="事件 ID" value={event.eventId} />
          <IdRow label="Session" value={event.sessionId} />
          <IdRow label="Trace" value={event.traceId} />
          <IdRow label="Span" value={event.spanId} />
        </div>
      </section>
    </div>
  );
}

function FactList({ facts }: { facts: Fact[] }) {
  const visible = facts.filter((fact) => hasValue(fact.value));
  if (!visible.length) return null;
  return (
    <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
      {visible.map((fact) => (
        <div key={fact.label} className="contents">
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="min-w-0 break-words text-right font-medium tabular-nums">
            {formatFact(fact.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ChipRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge key={value} variant="secondary">{value}</Badge>
        ))}
      </div>
    </div>
  );
}

function IdRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <CopyableId value={value} short={false} />
    </div>
  );
}

function hasRenderable(node: ReactNode): boolean {
  if (node === null || node === undefined || node === false) return false;
  if (Array.isArray(node)) return node.some(hasRenderable);
  return true;
}

function hasValue(value: FactValue): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  return true;
}

function formatFact(value: FactValue): string {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

function boolLabel(value: unknown): string | undefined {
  if (typeof value !== 'boolean') return undefined;
  return value ? '是' : '否';
}

function numberLabel(value: unknown): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
}

function refreshRateLabel(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return `${Math.round(value)} Hz`;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function objectEntries(value: unknown): Array<[string, string]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined && entry !== null && String(entry).length > 0)
    .map(([key, entry]) => [key, String(entry)]);
}
