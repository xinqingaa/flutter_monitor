import type { JsonObject } from '../datasource/types';

export function buildCurlCommand(input: {
  method?: string;
  url?: string;
  query?: unknown;
  headers?: JsonObject;
  body?: unknown;
}): string {
  const url = requestUrl(input.url, input.query);
  if (!url) throw new Error('missing_url');
  const method = input.method?.toUpperCase();
  const lines = [`curl ${shellQuote(url)}`];
  if (method && method !== 'GET') lines.push(`  -X ${method}`);
  for (const [key, value] of Object.entries(input.headers ?? {})) {
    if (value === undefined) continue;
    lines.push(`  -H ${shellQuote(`${key}: ${formatHeaderValue(value)}`)}`);
  }
  if (hasContent(input.body)) {
    lines.push(`  --data-raw ${shellQuote(bodyToText(input.body))}`);
  }
  return lines.join(' \\\n');
}

function requestUrl(url?: string, query?: unknown): string | undefined {
  if (!url) return undefined;
  if (!hasContent(query) || url.includes('?')) return url;
  const queryText = queryToString(query);
  return queryText ? `${url}?${queryText}` : url;
}

function queryToString(value: unknown): string {
  if (typeof value === 'string') return value.replace(/^\?/, '');
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(value as JsonObject)) {
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      for (const item of raw) params.append(key, String(item));
    } else {
      params.append(key, String(raw));
    }
  }
  return params.toString();
}

function bodyToText(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatHeaderValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => formatHeaderValue(item)).join(', ');
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function hasContent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}
