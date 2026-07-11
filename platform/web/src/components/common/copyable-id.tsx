import { Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../ui/toast';
import { copyText } from '../../shared/formatting/download';

export function CopyableId({ value, short = true }: { value?: string; short?: boolean }) {
  const { showToast } = useToast();
  const display = value ? (short && value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value) : '-';

  async function copyValue() {
    if (!value) return;
    try {
      await copyText(value);
      showToast({ tone: 'success', title: '已复制 ID', description: value });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '浏览器拒绝了剪贴板写入。' });
    }
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <code className="min-w-0 truncate rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700">{display}</code>
      {value ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          aria-label={`复制 ID ${display}`}
          onClick={() => void copyValue()}
        >
          <Copy className="size-3.5" />
        </Button>
      ) : null}
    </span>
  );
}
