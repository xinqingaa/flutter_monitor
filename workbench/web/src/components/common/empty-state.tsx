import { Inbox } from 'lucide-react';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-center">
      <Inbox className="size-5 text-zinc-400" />
      <div className="text-[12px] font-medium text-zinc-700">{title}</div>
      {description ? <div className="max-w-sm text-[11px] text-zinc-500">{description}</div> : null}
    </div>
  );
}
