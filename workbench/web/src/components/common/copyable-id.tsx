import { Copy } from 'lucide-react';
import { Button } from '../ui/button';

export function CopyableId({ value, short = true }: { value?: string; short?: boolean }) {
  const display = value ? (short && value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value) : '-';
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <code className="min-w-0 truncate rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700">{display}</code>
      {value ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          title="Copy ID"
          onClick={() => void navigator.clipboard?.writeText(value)}
        >
          <Copy className="size-3.5" />
        </Button>
      ) : null}
    </span>
  );
}
