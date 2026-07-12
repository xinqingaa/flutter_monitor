import { CalendarIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { useIsMobile } from '../../shared/hooks/use-mobile';

export function DateRangePicker({ from, to, onChange, className }: { from?: string; to?: string; onChange: (value: { from?: string; to?: string }) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const value = useMemo<DateRange | undefined>(() => {
    const start = parseDate(from);
    const end = parseDate(to);
    return start || end ? { from: start, to: end } : undefined;
  }, [from, to]);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="outline" className={`h-9 min-w-48 justify-start border-border-default bg-surface px-3 font-normal shadow-none ${className ?? ''}`} aria-label="选择日期范围">
        <CalendarIcon className="text-text-muted" />
        <span className="truncate">{rangeLabel(value)}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-0">
      <Calendar mode="range" selected={value} numberOfMonths={mobile ? 1 : 2} onSelect={(range) => { if (!range?.from) return; if (!range.to) return; const end = new Date(range.to); end.setHours(23, 59, 59, 999); onChange({ from: startOfDay(range.from).toISOString(), to: end.toISOString() }); setOpen(false); }} />
    </PopoverContent>
  </Popover>;
}

function parseDate(value?: string) { if (!value) return undefined; const date = new Date(value); return Number.isNaN(date.getTime()) ? undefined : date; }
function startOfDay(value: Date) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
function rangeLabel(value?: DateRange) { if (!value?.from) return '全部时间'; const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; return value.to ? `${format(value.from)} - ${format(value.to)}` : format(value.from); }
