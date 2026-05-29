export interface FieldDefinition {
  path: string;
  label: string;
  description: string;
  source: string;
  privacy: 'public' | 'internal' | 'user' | 'sensitive' | 'mixed';
  searchable: boolean;
  emptyHint: string;
}

export const fieldDefinitions: FieldDefinition[] = [
  {
    path: 'eventId',
    label: '事件 ID',
    description: '单个 EventEnvelope 的唯一标识，用于从摘要回查完整事件。',
    source: 'envelope',
    privacy: 'internal',
    searchable: true,
    emptyHint: '事件进入 Workbench 时会自动补齐。',
  },
  {
    path: 'sessionId',
    label: '会话',
    description: '一次用户使用过程或可分析活动窗口。',
    source: 'SDK session context',
    privacy: 'internal',
    searchable: true,
    emptyHint: '未初始化 session 或事件未绑定 session。',
  },
  {
    path: 'traceId',
    label: '链路',
    description: '一次可追踪流程，例如冷启动、页面打开、接口调用链或业务流程。',
    source: 'SDK tracing',
    privacy: 'internal',
    searchable: true,
    emptyHint: '该事件不是 trace/span 流程的一部分。',
  },
  {
    path: 'spanId',
    label: '阶段',
    description: 'trace 中的一个阶段，例如 SDK 初始化、首帧、HTTP 请求或业务步骤。',
    source: 'SDK tracing',
    privacy: 'internal',
    searchable: true,
    emptyHint: '该事件没有 span 粒度。',
  },
  {
    path: 'context.route.name',
    label: '当前页面',
    description: '事件发生时所在 route，用于还原用户路径和页面维度聚合。',
    source: 'SDK route context',
    privacy: 'internal',
    searchable: true,
    emptyHint: '未接入 route observer 或该事件没有页面上下文。',
  },
  {
    path: 'context.user.userId',
    label: '用户 ID',
    description: '接入方提供的用户标识，用于 QA 根据用户和时间范围回查 session。',
    source: 'SDK user context',
    privacy: 'user',
    searchable: true,
    emptyHint: '业务未设置 user context，不能按用户检索。',
  },
  {
    path: 'resource.app.appVersion',
    label: 'App 版本',
    description: '事件发生时的应用版本，用于版本对比和回归定位。',
    source: 'SDK resource',
    privacy: 'internal',
    searchable: true,
    emptyHint: '应用资源信息未配置。',
  },
  {
    path: 'resource.app.environment',
    label: '环境',
    description: 'dev、test、staging、production 等运行环境。',
    source: 'SDK resource',
    privacy: 'internal',
    searchable: true,
    emptyHint: '应用环境未配置。',
  },
  {
    path: 'durationMs',
    label: '耗时',
    description: '事件、trace 或 span 的持续时间，性能分析优先使用该字段。',
    source: 'envelope',
    privacy: 'public',
    searchable: true,
    emptyHint: '该事件是瞬时事件或没有 duration。',
  },
  {
    path: 'attributes.http.statusCode',
    label: 'HTTP 状态码',
    description: '网络请求响应码，用于识别失败请求和服务端异常。',
    source: 'network collector',
    privacy: 'internal',
    searchable: true,
    emptyHint: '非 HTTP 事件或请求未产生响应。',
  },
  {
    path: 'payload.breadcrumbs',
    label: '上下文足迹',
    description: '问题发生前后的关键上下文足迹。',
    source: 'SDK payload',
    privacy: 'mixed',
    searchable: false,
    emptyHint: '该事件没有携带 breadcrumb 快照。',
  },
];

export function fieldDefinitionFor(path: string): FieldDefinition | undefined {
  return fieldDefinitions.find((field) => field.path === path);
}
