import type { JsonObject, MonitorEvent } from '../datasource/types';

export function readCanonicalPath(event: MonitorEvent | undefined, path: string): unknown {
  if (!event) return undefined;

  const direct = readNestedPath(event, path.split('.'));
  if (direct !== undefined) return direct;

  if (path.startsWith('attributes.')) {
    return readFlattenedMap(event.attributes, path.slice('attributes.'.length));
  }

  if (path.startsWith('payload.')) {
    return readPayloadPath(event.payload, path);
  }

  return undefined;
}

export function readStringPath(event: MonitorEvent | undefined, path: string): string | undefined {
  const value = readCanonicalPath(event, path);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readPayloadPath(payload: JsonObject | undefined, path: string): unknown {
  if (!isRecord(payload)) return undefined;

  if (payload[path] !== undefined) return payload[path];

  const keyWithoutPrefix = path.slice('payload.'.length);
  if (payload[keyWithoutPrefix] !== undefined) return payload[keyWithoutPrefix];

  return readNestedPath(payload, keyWithoutPrefix.split('.'));
}

function readFlattenedMap(value: JsonObject | undefined, key: string): unknown {
  if (!isRecord(value)) return undefined;
  if (value[key] !== undefined) return value[key];
  return readNestedPath(value, key.split('.'));
}

function readNestedPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
