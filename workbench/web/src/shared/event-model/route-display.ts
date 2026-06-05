import type { JsonObject, MonitorEvent, PerformanceMetricEvent } from '../datasource/types';
import { readCanonicalPath, readStringPath } from './field-path';

export type RouteDisplaySource = {
  attributes?: JsonObject;
  context?: JsonObject;
  payload?: JsonObject;
  route?: string;
  traceId?: string;
  eventId?: string;
  timestamp?: string;
};

export function routeGroupName(source: RouteDisplaySource | undefined): string {
  return firstString(
    source?.route,
    readString(source, 'context.route.name'),
    readString(source, 'attributes.page.route'),
    readString(source, 'payload.route.name'),
  ) ?? '未知页面';
}

export function routeGroupKey(source: RouteDisplaySource | undefined): string {
  return routeGroupName(source);
}

export function pageInstanceId(source: RouteDisplaySource | undefined): string | undefined {
  return readString(source, 'attributes.page.instance_id');
}

export function routeInstanceDisplayName(source: RouteDisplaySource | undefined): string {
  const group = routeGroupName(source);
  const concrete = concreteRouteName(source, group);
  if (concrete) return concrete;
  return pageInstanceId(source) ?? group;
}

export function concreteRouteName(source: RouteDisplaySource | undefined, groupRoute = routeGroupName(source)): string | undefined {
  const candidates = [
    readString(source, 'attributes.page.route_display'),
    readString(source, 'attributes.page.route_full_name'),
    readString(source, 'attributes.page.full_route'),
    readString(source, 'context.route.displayName'),
    readString(source, 'context.route.display_name'),
    readString(source, 'context.route.fullName'),
    readString(source, 'context.route.full_name'),
    readString(source, 'payload.route.displayName'),
    readString(source, 'payload.route.display_name'),
    readString(source, 'payload.route.fullName'),
    readString(source, 'payload.route.full_name'),
    readString(source, 'payload.route.name'),
  ];

  return candidates.find((candidate) => Boolean(candidate && candidate !== groupRoute));
}

function readString(source: RouteDisplaySource | undefined, path: string): string | undefined {
  if (!source) return undefined;
  const value = readStringPath(source as MonitorEvent, path);
  if (value) return value;
  const fallback = readFlattened(source, path);
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : undefined;
}

function readFlattened(source: RouteDisplaySource, path: string): unknown {
  if (path.startsWith('attributes.')) return source.attributes?.[path.slice('attributes.'.length)];
  if (path.startsWith('context.')) return readNested(source.context, path.slice('context.'.length).split('.'));
  if (path.startsWith('payload.')) return readCanonicalPath(source as MonitorEvent, path);
  return undefined;
}

function readNested(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function firstString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0 && value !== '-');
}

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
