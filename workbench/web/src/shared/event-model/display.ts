import type { BadgeProps } from '../../components/ui/badge';
import type { MonitorEvent } from '../datasource/types';
import { fieldDefinitionFor } from '../field-dictionary/fields';
import { formatDuration } from '../formatting/format';
import { eventKind } from './accessors';
import { readCanonicalPath, readStringPath } from './field-path';
import { nativeActivity, nativeCallback, nativeRawState, nativeTrimLevel, nativeTrimLevelName } from './native';

export interface DisplayField {
  path: string;
  value: string;
  description?: string;
  compactPath?: string;
}

export interface EventDisplayModel {
  signalType: string;
  signalDescription: string;
  signalTone: BadgeProps['tone'];
  name: string;
  nameDescription?: string;
  phase?: DisplayField;
  status?: DisplayField;
  duration?: DisplayField;
  primaryFields: DisplayField[];
  secondaryFields: DisplayField[];
  debugIds: {
    sessionId?: string;
    traceId?: string;
    spanId?: string;
    eventId?: string;
    signalType?: string;
  };
}

export interface TimelineDisplayModel {
  kindLabel: string;
  title: string;
  durationLabel?: string;
  phaseLabel?: string;
  summaryItems: string[];
  tone: BadgeProps['tone'];
}

export function eventDisplay(event: MonitorEvent): EventDisplayModel {
  const signalType = event.signalType ?? 'event';
  const name = event.name ?? '-';
  const phaseValue = readStringPath(event, 'attributes.event.phase');
  const statusValue = event.status;
  const primaryFields: DisplayField[] = [];
  const secondaryFields: DisplayField[] = [];

  pushField(event, primaryFields, 'context.route.name', { skipDash: true });
  collectNameFields(event, primaryFields, secondaryFields);

  return {
    signalType,
    signalDescription: signalDescription(signalType),
    signalTone: signalTone(event),
    name,
    nameDescription: nameDescription(name),
    phase: phaseValue
      ? {
          path: 'attributes.event.phase',
          compactPath: 'phase',
          value: phaseValue,
          description: phaseLabel(phaseValue) ?? fieldDescription('attributes.event.phase'),
        }
      : undefined,
    status: statusValue
      ? {
          path: 'status',
          value: statusValue,
          description: statusLabel(statusValue) ?? fieldDescription('status'),
        }
      : undefined,
    duration:
      typeof event.durationMs === 'number'
        ? { path: 'durationMs', value: formatDuration(event.durationMs), description: fieldDescription('durationMs') }
        : undefined,
    primaryFields,
    secondaryFields,
    debugIds: {
      sessionId: event.sessionId,
      traceId: event.traceId,
      spanId: event.spanId,
      eventId: event.eventId,
      signalType: event.signalType,
    },
  };
}

export function timelineDisplay(event: MonitorEvent): TimelineDisplayModel {
  const name = event.name ?? '';
  const kind = eventKind(event);
  const route = readStringPath(event, 'context.route.name');
  const duration = typeof event.durationMs === 'number' ? formatDuration(event.durationMs) : undefined;
  const status = event.status;
  const phase = readStringPath(event, 'attributes.event.phase');
  const base = {
    kindLabel: timelineKindLabel(event),
    phaseLabel: phase ? timelinePhaseLabel(phase) : undefined,
    tone: signalTone(event),
  };

  if (name === 'app.cold_start' || name === 'app.hot_start') {
    const startType = readStringPath(event, 'attributes.app.start.type');
    const firstFrame = formatNumberMetric(event, 'attributes.app.first_frame_ms', 'ms');
    return {
      ...base,
      title: name === 'app.hot_start' || startType === 'hot' ? '热重启' : '冷启动',
      durationLabel: duration ?? firstFrame,
      summaryItems: compactItems(route ? `页面 ${route}` : undefined, firstFrame ? `首帧 ${firstFrame}` : undefined),
    };
  }

  if (name === 'app.first_frame') {
    return { ...base, title: '启动首帧', durationLabel: duration, summaryItems: compactItems(route ? `页面 ${route}` : undefined) };
  }

  if (name === 'sdk.init') {
    const initDuration = formatNumberMetric(event, 'attributes.sdk.init.duration_ms', 'ms');
    return { ...base, title: 'SDK 初始化', durationLabel: initDuration ?? duration, summaryItems: [] };
  }

  if (name === 'page.visit') {
    const phase = readStringPath(event, 'attributes.event.phase');
    if (phase === 'end') {
      const to = readStringPath(event, 'attributes.page.to');
      const reason = readStringPath(event, 'payload.page.end_reason');
      const verb = reason === 'route_pop' && to ? `返回 ${to}` : route ? `离开页面 ${route}` : '离开页面';
      return { ...base, title: verb, durationLabel: duration, summaryItems: compactItems(route ? `来源页面 ${route}` : undefined) };
    }
    const from = readStringPath(event, 'attributes.page.from') ?? readStringPath(event, 'payload.route.previous');
    return { ...base, title: route ? `进入页面 ${route}` : '进入页面', summaryItems: compactItems(from ? `来源 ${from}` : undefined) };
  }

  if (name === 'route.push') {
    const from = readStringPath(event, 'attributes.page.from') ?? readStringPath(event, 'payload.route.previous');
    const to = readStringPath(event, 'attributes.page.to') ?? readStringPath(event, 'payload.route.name') ?? route;
    return {
      ...base,
      title: to ? (from ? `从 ${from} 进入 ${to}` : `路由切换到 ${to}`) : '路由切换',
      durationLabel: duration,
      summaryItems: compactItems(from && to ? `目标 ${to}` : from ? `来源 ${from}` : undefined),
    };
  }

  if (name === 'page.load') {
    const load = formatNumberMetric(event, 'attributes.page.load_ms', 'ms');
    const firstFrame = formatNumberMetric(event, 'attributes.page.first_frame_ms', 'ms');
    return {
      ...base,
      title: '页面加载',
      durationLabel: load ?? duration,
      summaryItems: compactItems(route ? `页面 ${route}` : undefined, firstFrame ? `首帧 ${firstFrame}` : undefined),
    };
  }

  if (name === 'page.first_frame') {
    const firstFrame = formatNumberMetric(event, 'attributes.page.first_frame_ms', 'ms');
    return { ...base, title: '页面首帧', durationLabel: firstFrame ?? duration, summaryItems: compactItems(route ? `页面 ${route}` : undefined) };
  }

  if (name === 'page.view') {
    return { ...base, title: route ? `页面访问 ${route}` : '页面访问', summaryItems: [] };
  }

  if (name === 'page.stay') {
    return { ...base, title: route ? `页面停留 ${route}` : '页面停留', durationLabel: duration, summaryItems: [] };
  }

  if (name === 'http.client') {
    const method = readStringPath(event, 'attributes.http.method');
    const url = readStringPath(event, 'attributes.http.url.normalized');
    const statusCode = readCanonicalPath(event, 'attributes.http.status_code');
    return {
      ...base,
      title: [method, url].filter(Boolean).join(' ') || '网络请求',
      durationLabel: duration,
      summaryItems: compactItems(statusCode === undefined ? undefined : `HTTP ${statusCode}`),
    };
  }

  if (name === 'ui.jank.sequence' || kind === 'jank') {
    const count = readCanonicalPath(event, 'attributes.jank.count');
    const maxFrame = formatNumberMetric(event, 'attributes.frame.max_ms', 'ms');
    const avgFrame = formatNumberMetric(event, 'attributes.frame.avg_ms', 'ms', 1);
    return {
      ...base,
      title: typeof count === 'number' ? `连续卡顿 ${count} 帧` : '连续卡顿',
      durationLabel: maxFrame ? `最慢 ${maxFrame}` : duration,
      summaryItems: compactItems(route ? `页面 ${route}` : undefined, avgFrame ? `平均 ${avgFrame}` : undefined),
    };
  }

  if (name === 'memory.growth') {
    const growth = formatNumberMetric(event, 'attributes.memory.growth_mb', 'MB', 1);
    const window = formatNumberMetric(event, 'attributes.memory.growth_duration_ms', 'ms');
    const baseline = formatNumberMetric(event, 'payload.evidence.baseline.used_mb', 'MB', 1);
    const current = formatNumberMetric(event, 'payload.evidence.current.used_mb', 'MB', 1);
    return {
      ...base,
      title: '内存增长',
      durationLabel: growth ? `+${growth}` : duration,
      summaryItems: compactItems(window ? `窗口 ${window}` : undefined, baseline && current ? `${baseline} -> ${current}` : undefined),
    };
  }

  if (name === 'memory.leak.suspect') {
    const growth = formatNumberMetric(event, 'attributes.memory.growth_mb', 'MB', 1);
    const threshold = formatNumberMetric(event, 'payload.evidence.threshold_mb', 'MB', 0);
    const reason = readStringPath(event, 'payload.evidence.reason');
    const assertion = readStringPath(event, 'payload.assertion');
    return {
      ...base,
      title: '疑似泄漏线索',
      durationLabel: growth ? `+${growth}` : duration,
      summaryItems: compactItems(threshold ? `阈值 ${threshold}` : undefined, reason, assertion),
    };
  }

  if (name === 'memory.pressure' || name === 'native.memory.pressure') {
    const level = readStringPath(event, 'attributes.memory.pressure_level');
    const nativeUsed = formatNumberMetric(event, 'attributes.memory.native_used_mb', 'MB', 1);
    const source = readStringPath(event, 'attributes.memory.sample_source');
    return {
      ...base,
      title: name === 'native.memory.pressure' ? 'Native 内存压力' : '内存压力',
      durationLabel: level ? memoryPressureLabel(level) : undefined,
      summaryItems: compactItems(nativeUsed ? `Native ${nativeUsed}` : undefined, source ? `来源 ${source}` : undefined),
    };
  }

  if (name === 'native.memory.sample') {
    const nativeUsed = formatNumberMetric(event, 'attributes.memory.native_used_mb', 'MB', 1);
    const heap = formatNumberMetric(event, 'attributes.memory.heap_used_mb', 'MB', 1);
    const source = readStringPath(event, 'attributes.memory.sample_source');
    return {
      ...base,
      title: 'Native 内存采样',
      durationLabel: nativeUsed ? `Native ${nativeUsed}` : heap ? `Heap ${heap}` : undefined,
      summaryItems: compactItems(heap ? `Heap ${heap}` : undefined, source ? `来源 ${source}` : undefined),
    };
  }

  if (name === 'native.lifecycle') {
    const callback = nativeCallback(event);
    const rawState = nativeRawState(event);
    const activity = nativeActivity(event);
    const trimName = nativeTrimLevelName(event);
    const trimLevel = nativeTrimLevel(event);
    return {
      ...base,
      kindLabel: 'Native',
      title: callback ? `Native 生命周期 ${callback}` : 'Native 生命周期',
      summaryItems: compactItems(
        rawState ? `rawState ${rawState}` : undefined,
        trimName ? `${trimName}${trimLevel !== undefined ? ` · level ${trimLevel}` : ''}` : undefined,
        activity ? compactActivity(activity) : undefined,
      ),
      tone: trimName ? 'warn' : 'info',
    };
  }

  if (name === 'memory.sample' || kind === 'memory') {
    const rss = formatNumberMetric(event, 'attributes.memory.rss_mb', 'MB', 1);
    const source = readStringPath(event, 'attributes.memory.sample_source');
    return { ...base, title: '内存采样', durationLabel: rss ? `RSS ${rss}` : undefined, summaryItems: compactItems(source ? `来源 ${source}` : undefined) };
  }

  if (name === 'app.lifecycle') {
    const state = readStringPath(event, 'context.lifecycle.state');
    const previous = readStringPath(event, 'context.lifecycle.previousState');
    return {
      ...base,
      title: state ? `生命周期 ${lifecycleStateLabel(state)}` : '生命周期变化',
      summaryItems: compactItems(previous ? `来自 ${lifecycleStateLabel(previous)}` : undefined),
    };
  }

  if (name === 'app.foreground_duration') {
    return { ...base, title: '前台停留', durationLabel: duration, summaryItems: [] };
  }

  if (name === 'app.background_duration') {
    return { ...base, title: '后台停留', durationLabel: duration, summaryItems: [] };
  }

  if (name === 'sdk.lifecycle.flush') {
    const success = readCanonicalPath(event, 'attributes.app.exit_flush.success');
    return { ...base, title: success === false ? '退出前 flush 失败' : '退出前 flush', summaryItems: compactItems(statusLabel(status ?? '')) };
  }

  if (kind === 'error') {
    const errorType = readStringPath(event, 'attributes.error.type');
    const message = readStringPath(event, 'payload.error.message');
    return { ...base, kindLabel: '错误', title: errorType ?? '错误', summaryItems: compactItems(message), tone: 'danger' };
  }

  const action = readStringPath(event, 'attributes.business.action');
  const result = readStringPath(event, 'attributes.business.result');
  const target = readStringPath(event, 'attributes.ui.target');
  if (action || target) {
    return {
      ...base,
      title: action ? `业务动作 ${action}` : `用户操作 ${target}`,
      summaryItems: compactItems(result ? trackResultLabel(result) : target),
    };
  }

  return {
    ...base,
    title: nameDescription(name) ?? (name || '事件'),
    durationLabel: duration,
    summaryItems: compactItems(route ? `页面 ${route}` : undefined),
  };
}

export function formatDisplayField(field: DisplayField): string {
  return field.description ? `${field.path}=${field.value} · ${field.description}` : `${field.path}=${field.value}`;
}

function formatNumberMetric(event: MonitorEvent, path: string, unit: string, digits = 0): string | undefined {
  const value = readCanonicalPath(event, path);
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return `${value.toFixed(digits)}${unit}`;
}

function lifecycleStateLabel(value: string): string {
  const labels: Record<string, string> = {
    resumed: '前台',
    inactive: '非活跃',
    paused: '后台',
    detached: '退出',
    hidden: '隐藏',
  };
  return labels[value] ?? value;
}

function memoryPressureLabel(value: string): string {
  const labels: Record<string, string> = {
    none: '无压力',
    moderate: '中等压力',
    critical: '严重压力',
    unknown: '未知压力',
  };
  return labels[value] ?? value;
}

function compactActivity(value: string): string {
  const parts = value.split('.');
  return parts[parts.length - 1] ?? value;
}

function timelinePhaseLabel(value: string): string {
  const labels: Record<string, string> = {
    start: '开始',
    end: '结束',
    instant: '瞬时',
  };
  return labels[value] ?? value;
}

function timelineKindLabel(event: MonitorEvent): string {
  const kind = eventKind(event);
  const labels: Record<string, string> = {
    error: '错误',
    http: '网络',
    jank: '卡顿',
    page: '页面',
    startup: '启动',
    memory: '内存',
    lifecycle: '生命周期',
    business: '业务',
    trace: '链路',
    span: '阶段',
    metric: '指标',
    breadcrumb: '足迹',
    sdk: 'SDK',
  };
  return labels[kind] ?? kind;
}

function compactItems(...items: Array<string | undefined>): string[] {
  return items.filter((item): item is string => Boolean(item));
}

function trackResultLabel(value: string): string {
  const labels: Record<string, string> = {
    started: '开始',
    success: '成功',
    failed: '失败',
    cancelled: '取消',
    unknown: '未知',
  };
  return labels[value] ?? value;
}

export function formatCompactField(field: DisplayField): string {
  return `${field.compactPath ?? compactCanonicalPath(field.path)}=${field.value}`;
}

function collectNameFields(event: MonitorEvent, primary: DisplayField[], secondary: DisplayField[]) {
  const name = event.name ?? '';

  if (name === 'http.client') {
    pushField(event, primary, 'attributes.http.method');
    pushField(event, primary, 'attributes.http.url.normalized');
    pushField(event, secondary, 'attributes.http.status_code', { skipDash: true });
    pushField(event, secondary, 'attributes.http.success');
    pushField(event, secondary, 'attributes.http.error_type');
    return;
  }

  if (eventKind(event) === 'error') {
    pushField(event, primary, 'attributes.error.type');
    pushField(event, primary, 'attributes.error.mechanism');
    pushField(event, primary, 'payload.error.message');
    pushField(event, secondary, 'attributes.error.handled');
    pushField(event, secondary, 'attributes.error.fatal');
    pushField(event, secondary, 'payload.error.library');
    return;
  }

  if (name.startsWith('page.') || name === 'route.push') {
    pushField(event, secondary, 'attributes.page.load_ms', { unit: 'ms' });
    pushField(event, secondary, 'attributes.page.first_frame_ms', { unit: 'ms' });
    pushField(event, secondary, 'attributes.page.interactive_ms', { unit: 'ms' });
    pushField(event, secondary, 'attributes.page.instance_id');
    pushField(event, secondary, 'attributes.page.from');
    pushField(event, secondary, 'attributes.page.to');
    return;
  }

  if (name === 'app.cold_start' || name === 'app.hot_start' || name === 'app.first_frame' || name === 'sdk.init') {
    pushField(event, primary, 'attributes.app.start.type');
    pushField(event, primary, 'attributes.app.start.end_reason');
    pushField(event, secondary, 'attributes.app.first_frame_ms', { unit: 'ms' });
    pushField(event, secondary, 'attributes.app.interactive_ms', { unit: 'ms' });
    pushField(event, secondary, 'attributes.sdk.init.duration_ms', { unit: 'ms' });
    pushField(event, secondary, 'attributes.native.start.elapsed_ms', { unit: 'ms' });
    return;
  }

  if (name === 'ui.jank.sequence' || name.includes('jank')) {
    pushField(event, primary, 'attributes.jank.count');
    pushField(event, secondary, 'attributes.frame.max_ms', { unit: 'ms' });
    pushField(event, secondary, 'attributes.frame.avg_ms', { unit: 'ms', digits: 1 });
    pushField(event, secondary, 'attributes.frame.fps', { digits: 1 });
    pushField(event, secondary, 'attributes.frame.stability', { digits: 2 });
    return;
  }

  if (name === 'memory.sample' || name.startsWith('memory.')) {
    pushField(event, primary, 'attributes.memory.rss_mb', { unit: 'MB', digits: 1 });
    pushField(event, primary, 'attributes.memory.growth_mb', { unit: 'MB', digits: 1 });
    pushField(event, primary, 'attributes.memory.pressure_level');
    pushField(event, secondary, 'attributes.memory.heap_used_mb', { unit: 'MB', digits: 1 });
    pushField(event, secondary, 'attributes.memory.heap_capacity_mb', { unit: 'MB', digits: 1 });
    pushField(event, secondary, 'attributes.memory.native_used_mb', { unit: 'MB', digits: 1 });
    pushField(event, secondary, 'attributes.memory.growth_duration_ms', { unit: 'ms' });
    pushField(event, secondary, 'attributes.memory.sample_source');
    pushField(event, secondary, 'payload.evidence.baseline.used_mb', { unit: 'MB', digits: 1 });
    pushField(event, secondary, 'payload.evidence.current.used_mb', { unit: 'MB', digits: 1 });
    pushField(event, secondary, 'payload.evidence.threshold_mb', { unit: 'MB', digits: 0 });
    pushField(event, secondary, 'payload.evidence.reason');
    pushField(event, secondary, 'payload.assertion');
    return;
  }

  if (name === 'native.memory.sample' || name === 'native.memory.pressure') {
    pushField(event, primary, 'attributes.memory.native_used_mb', { unit: 'MB', digits: 1 });
    pushField(event, primary, 'attributes.memory.pressure_level');
    pushField(event, secondary, 'attributes.memory.heap_used_mb', { unit: 'MB', digits: 1 });
    pushField(event, secondary, 'attributes.memory.heap_capacity_mb', { unit: 'MB', digits: 1 });
    pushField(event, secondary, 'attributes.memory.rss_mb', { unit: 'MB', digits: 1 });
    pushField(event, secondary, 'attributes.memory.sample_source');
    pushField(event, secondary, 'attributes.native.signal');
    pushField(event, secondary, 'payload.native.sampleSource');
    return;
  }

  if (name === 'native.lifecycle') {
    pushField(event, primary, 'attributes.native.signal');
    pushField(event, primary, 'payload.native.callback');
    pushField(event, primary, 'payload.native.rawState');
    pushField(event, secondary, 'context.lifecycle.state');
    pushField(event, secondary, 'context.lifecycle.previousState');
    pushField(event, secondary, 'payload.native.activity');
    pushField(event, secondary, 'payload.native.trimLevel');
    pushField(event, secondary, 'payload.native.trimLevelName');
    return;
  }

  if (name === 'app.lifecycle' || name === 'app.foreground_duration' || name === 'app.background_duration') {
    pushField(event, primary, 'context.lifecycle.state');
    pushField(event, secondary, 'context.lifecycle.previousState');
    pushField(event, secondary, 'context.lifecycle.isForeground');
    return;
  }

  if (name === 'sdk.lifecycle.flush') {
    pushField(event, primary, 'attributes.app.exit_flush.success');
    pushField(event, secondary, 'payload.lifecycle.trigger_state');
    pushField(event, secondary, 'payload.lifecycle.context_state');
    return;
  }

  pushField(event, primary, 'attributes.business.action');
  pushField(event, primary, 'attributes.business.result');
  pushField(event, primary, 'attributes.ui.target');
  pushField(event, secondary, 'attributes.ui.action');
}

function pushField(
  event: MonitorEvent,
  target: DisplayField[],
  path: string,
  options: { unit?: string; digits?: number; skipDash?: boolean; compactPath?: string } = {},
) {
  const value = readCanonicalPath(event, path);
  if (value === undefined || value === null || value === '') return;
  if (options.skipDash && value === '-') return;
  let rendered: string;
  if (typeof value === 'number') {
    rendered = `${value.toFixed(options.digits ?? 0)}${options.unit ?? ''}`;
  } else if (typeof value === 'boolean') {
    rendered = String(value);
  } else {
    rendered = String(value);
  }
  target.push({
    path,
    value: rendered,
    compactPath: options.compactPath,
    description: fieldDescription(path),
  });
}

function signalDescription(signalType: string): string {
  const descriptions: Record<string, string> = {
    trace: '一次可排查流程的根事件或流程摘要',
    span: 'trace 内部的一个阶段',
    breadcrumb: '问题发生前后的关键上下文足迹',
    metric: '可聚合的指标事件',
    error: '错误事件',
    log: '日志事件',
    sdk: 'SDK 自监控事件',
  };
  return descriptions[signalType] ?? '普通事件';
}

function signalTone(event: MonitorEvent): BadgeProps['tone'] {
  const kind = eventKind(event);
  if (event.status === 'error' || event.signalType === 'error') return 'danger';
  if (kind === 'http') return event.status === 'error' ? 'danger' : 'info';
  if (kind === 'jank') return 'warn';
  if (kind === 'page') return 'teal';
  if (kind === 'startup') return 'good';
  if (kind === 'memory') return 'purple';
  if (kind === 'business') return 'info';
  return 'neutral';
}

function statusLabel(value: string): string | undefined {
  const labels: Record<string, string> = {
    ok: '正常',
    error: '错误',
    cancelled: '取消',
    timeout: '超时',
    unknown: '未知',
  };
  return labels[value];
}

function phaseLabel(value: string): string | undefined {
  const labels: Record<string, string> = {
    start: '区间开始',
    end: '区间结束',
    instant: '瞬时事件',
  };
  return labels[value];
}

function nameDescription(name: string): string | undefined {
  const labels: Record<string, string> = {
    'app.cold_start': '冷启动',
    'app.hot_start': '热重启',
    'app.first_frame': '启动首帧',
    'sdk.init': 'SDK 初始化',
    'page.visit': '页面访问',
    'route.push': '路由切换',
    'page.load': '页面加载',
    'page.first_frame': '页面首帧',
    'page.view': '页面访问足迹',
    'app.lifecycle': '生命周期变化',
    'app.foreground_duration': '前台停留时间',
    'app.background_duration': '后台停留时间',
    'sdk.lifecycle.flush': '退出前 flush',
    'memory.sample': '内存采样',
    'http.client': '网络请求',
  };
  return labels[name];
}

function compactCanonicalPath(path: string): string {
  if (path.startsWith('attributes.')) return path.slice('attributes.'.length);
  if (path.startsWith('payload.')) return path.slice('payload.'.length);
  return path;
}

export function fieldDescription(path: string): string | undefined {
  const registered = fieldDefinitionFor(path);
  if (registered) return registered.description;

  const descriptions: Record<string, string> = {
    timestamp: '事件发生时间',
    startTime: 'trace/span/耗时类事件开始时间',
    endTime: 'trace/span/耗时类事件结束时间',
    level: '事件等级',
    priority: '上报优先级',
    parentSpanId: '父阶段 ID',
    'resource.sdk.name': 'SDK 名称',
    'resource.sdk.version': 'Flutter SDK package 版本',
    'resource.sdk.coreVersion': 'flutter_monitor_core 版本',
    'resource.sdk.nativeVersion': 'native plugin 版本',
    'resource.app.appKey': '应用标识',
    'resource.app.appName': '应用名称',
    'resource.app.appVersion': 'App 语义版本',
    'resource.app.buildNumber': 'App 构建号',
    'resource.app.packageName': '应用包名',
    'resource.app.environment': 'dev、test、staging、production',
    'resource.app.channel': '分发渠道',
    'resource.app.flavor': 'Flutter flavor 或企业自定义 flavor',
    'resource.device.platform': 'android/ios/web/macos 等',
    'resource.device.model': '设备型号',
    'resource.device.manufacturer': '设备厂商',
    'resource.device.osVersion': 'OS 版本',
    'resource.device.isPhysicalDevice': '是否真机',
    'resource.device.refreshRate': '屏幕刷新率',
    'resource.device.deviceTier': 'high/medium/low/unknown',
    'resource.runtime.flutterVersion': 'Flutter 版本',
    'resource.runtime.dartVersion': 'Dart 版本',
    'resource.runtime.isDebug': '是否 debug runtime',
    'context.user.userId': '用户标识',
    'context.user.userType': '用户类型',
    'context.user.userTags': '用户标签',
    'context.user.cohort': '用户分群',
    'context.route.stack': '当前 route stack',
    'context.route.source': '页面来源',
    'context.module.name': '业务模块，可选增强上下文',
    'context.module.scene': '业务场景，可选增强上下文',
    'context.network.type': 'wifi/cellular/none/unknown',
    'context.network.isWeakNetwork': '弱网判断',
    'context.release.releaseId': '可组合 app/package/version/build',
    'context.release.featureFlags': '事件发生时命中的 feature flags',
    'context.release.experiments': '实验名到分组的映射',
    'context.lifecycle.state': 'resumed/inactive/paused/detached/hidden',
    'context.lifecycle.previousState': '上一个生命周期状态',
    'context.lifecycle.isForeground': '是否前台',
    'context.native.available': 'native bridge 是否可用',
    'context.native.platform': 'android/ios 等 native platform',
    'context.native.processId': 'native 进程 ID',
    'context.native.bridgeVersion': 'native bridge 版本',
    'context.native.signalSource': 'native 信号来源',
    'context.missing': '上下文是否缺失',
    'context.missingReason': '上下文缺失原因',
    'attributes.app.interactive_ms': '启动可交互耗时',
    'attributes.sdk.init.duration_ms': 'SDK 初始化耗时',
    'attributes.native.start.elapsed_ms': 'native 启动起点到 Flutter 可观测点耗时',
    'attributes.page.interactive_ms': '页面可交互耗时',
    'attributes.page.from': '页面来源 route',
    'attributes.page.to': '页面离开后进入的 route',
    'attributes.http.method': 'GET/POST 等',
    'attributes.http.success': '请求是否成功',
    'attributes.http.error_type': '网络错误类型',
    'attributes.http.retry_count': '重试次数',
    'attributes.http.cache_status': 'hit/miss/bypass/unknown',
    'attributes.request.size_bytes': '请求大小',
    'attributes.response.size_bytes': '响应大小',
    'attributes.ui.action': 'tap/scroll/input 等',
    'attributes.business.result': '业务结果',
    'attributes.frame.avg_ms': '平均帧耗时',
    'attributes.frame.budget_ms': '帧预算',
    'attributes.frame.fps': '最近窗口 FPS',
    'attributes.frame.stability': '稳定性',
    'attributes.frame.p50_ms': '帧耗时 P50',
    'attributes.frame.p90_ms': '帧耗时 P90',
    'attributes.frame.p99_ms': '帧耗时 P99',
    'attributes.memory.heap_used_mb': 'Dart/Flutter heap 使用',
    'attributes.memory.heap_capacity_mb': 'heap 容量',
    'attributes.memory.external_mb': 'external memory',
    'attributes.memory.native_used_mb': 'native memory',
    'attributes.memory.growth_mb': '增长量',
    'attributes.memory.growth_duration_ms': '观察窗口',
    'attributes.memory.pressure_level': 'none/moderate/critical/unknown',
    'attributes.memory.sample_source': 'dart/native/system/unknown',
    'attributes.native.signal': 'memory/crash/anr/oom/lifecycle',
    'attributes.error.type': '错误类型',
    'attributes.error.mechanism': '错误机制',
    'attributes.error.handled': '是否已处理',
    'attributes.error.fatal': '是否致命',
    'attributes.error.thread': '错误线程',
    'payload.error.message': '错误消息',
    'payload.error.stacktrace': '错误堆栈',
    'payload.error.library': 'framework/library 上下文',
    'payload.truncated': 'payload 是否被裁剪',
    'payload.truncated.reason': 'payload 被裁剪的原因',
    'payload.trace': 'active trace/span 诊断快照',
    'payload.native': '脱敏后的 native 详情',
  };
  return descriptions[path];
}
