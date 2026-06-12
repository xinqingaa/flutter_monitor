import type { JsonObject, MonitorEvent } from '../datasource/types';
import { readStringPath } from './field-path';

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
    readString(source, 'payload.route.name'),
  ) ?? '未知页面';
}

export function routeGroupKey(source: RouteDisplaySource | undefined): string {
  return routeGroupName(source);
}

export function routeFullName(source: RouteDisplaySource | undefined): string | undefined {
  return firstString(
    readString(source, 'context.route.fullName'),
    readString(source, 'payload.route.name'),
  );
}

export function routeDisplayName(source: RouteDisplaySource | undefined): string {
  return routeFullName(source) ?? routeGroupName(source);
}

export function pageInstanceId(source: RouteDisplaySource | undefined): string | undefined {
  return readString(source, 'attributes.page.instance_id');
}

function readString(source: RouteDisplaySource | undefined, path: string): string | undefined {
  if (!source) return undefined;
  return readStringPath(source as MonitorEvent, path);
}

function firstString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0 && value !== '-');
}
