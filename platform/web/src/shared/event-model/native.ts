import type { MonitorEvent, PerformanceMetricEvent } from '../datasource/types';
import { readCanonicalPath, readStringPath } from './field-path';

type NativeEvent = MonitorEvent | PerformanceMetricEvent;

export interface NativeSessionSummary {
  available: boolean;
  version?: string;
  platform?: string;
  lifecycleCount: number;
  memoryCount: number;
  pressureCount: number;
  eventCount: number;
}

export function summarizeNativeSession(events: NativeEvent[]): NativeSessionSummary {
  let available = false;
  let version: string | undefined;
  let platform: string | undefined;
  let lifecycleCount = 0;
  let memoryCount = 0;
  let pressureCount = 0;
  let eventCount = 0;

  for (const event of events) {
    if (nativeAvailable(event)) available = true;
    version = version ?? readStringPath(event as MonitorEvent, 'resource.sdk.nativeVersion');
    platform = platform ?? readStringPath(event as MonitorEvent, 'context.native.platform');

    if (isNativeEvent(event)) eventCount += 1;
    if (isNativeLifecycleEvent(event)) lifecycleCount += 1;
    if (isNativeMemoryEvent(event)) memoryCount += 1;
    if (isNativePressureEvent(event)) pressureCount += 1;
  }

  return {
    available: available || Boolean(version) || eventCount > 0,
    version,
    platform,
    lifecycleCount,
    memoryCount,
    pressureCount,
    eventCount,
  };
}

export function isNativeEvent(event: NativeEvent | undefined): boolean {
  const name = event?.name ?? '';
  return name.startsWith('native.') || readStringPath(event as MonitorEvent | undefined, 'attributes.native.signal') !== undefined;
}

export function isNativeLifecycleEvent(event: NativeEvent | undefined): boolean {
  return event?.name === 'native.lifecycle' || readStringPath(event as MonitorEvent | undefined, 'attributes.native.signal') === 'lifecycle';
}

export function isNativeMemoryEvent(event: NativeEvent | undefined): boolean {
  const name = event?.name ?? '';
  return name === 'native.memory.sample' || name === 'native.memory.pressure' ||
    (name.startsWith('native.') && readStringPath(event as MonitorEvent | undefined, 'attributes.native.signal') === 'memory');
}

export function isNativePressureEvent(event: NativeEvent | undefined): boolean {
  return event?.name === 'native.memory.pressure';
}

export function nativeAvailable(event: NativeEvent | undefined): boolean {
  return readCanonicalPath(event as MonitorEvent | undefined, 'context.native.available') === true;
}

export function nativeCallback(event: NativeEvent | undefined): string | undefined {
  return readStringPath(event as MonitorEvent | undefined, 'payload.native.callback');
}

export function nativeRawState(event: NativeEvent | undefined): string | undefined {
  return readStringPath(event as MonitorEvent | undefined, 'payload.native.rawState');
}

export function nativeActivity(event: NativeEvent | undefined): string | undefined {
  return readStringPath(event as MonitorEvent | undefined, 'payload.native.activity');
}

export function nativeTrimLevelName(event: NativeEvent | undefined): string | undefined {
  return readStringPath(event as MonitorEvent | undefined, 'payload.native.trimLevelName');
}

export function nativeTrimLevel(event: NativeEvent | undefined): number | undefined {
  const value = readCanonicalPath(event as MonitorEvent | undefined, 'payload.native.trimLevel');
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
