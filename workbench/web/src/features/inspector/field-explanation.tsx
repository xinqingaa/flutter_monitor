import { Badge } from '../../components/ui/badge';
import { fieldDefinitions } from '../../shared/field-dictionary/fields';
import type { MonitorEvent } from '../../shared/datasource/types';
import { readCanonicalPath } from '../../shared/event-model/field-path';

export function FieldExplanation({ event }: { event?: MonitorEvent }) {
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden rounded-md border border-zinc-200">
      <header className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] font-semibold text-zinc-950">
        Field Explanation
      </header>
      <div className="grid gap-2 overflow-auto p-3">
        {fieldDefinitions.map((field) => {
          const value = event ? readCanonicalPath(event, field.path) : undefined;
          return (
            <div key={field.path} className="rounded-md border border-zinc-200 p-2">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-zinc-950">{field.label}</div>
                  <code className="text-[11px] text-zinc-500">{field.path}</code>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Badge tone={field.searchable ? 'teal' : 'neutral'}>{field.searchable ? 'search' : 'detail'}</Badge>
                  <Badge tone={field.privacy === 'user' || field.privacy === 'sensitive' ? 'warn' : 'neutral'}>{field.privacy}</Badge>
                </div>
              </div>
              <p className="my-1 text-[11px] text-zinc-600">{field.description}</p>
              <div className="rounded bg-zinc-50 px-2 py-1 text-[11px] text-zinc-700">
                <span className="text-zinc-500">value: </span>
                {value === undefined || value === '' ? field.emptyHint : formatValue(value)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
