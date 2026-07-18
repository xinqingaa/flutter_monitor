import * as React from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Field, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../../shared/formatting/cn';
import { useIsMobile } from '../../shared/hooks/use-mobile';

type TimeRangeValue = { from?: string; to?: string };
type QuickRange = '12h' | '24h' | '3d' | '7d' | '30d';

const quickRanges: Array<{ value: QuickRange; label: string; hours: number }> = [
  { value: '12h', label: '近 12 小时', hours: 12 },
  { value: '24h', label: '近 24 小时', hours: 24 },
  { value: '3d', label: '近 3 天', hours: 24 * 3 },
  { value: '7d', label: '近 7 天', hours: 24 * 7 },
  { value: '30d', label: '近 30 天', hours: 24 * 30 },
];

export function DateRangePicker({
  from,
  to,
  onChange,
  className,
  label = '时间范围',
}: {
  from?: string;
  to?: string;
  onChange: (value: TimeRangeValue) => void;
  className?: string;
  label?: string;
}) {
  const mobile = useIsMobile();
  const fieldId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<DateRange | undefined>(() => rangeFromProps(from, to));
  const selectedQuick = quickRangeFromValues(from, to);

  React.useEffect(() => {
    setDate(rangeFromProps(from, to));
  }, [from, to]);

  function applyQuick(option: (typeof quickRanges)[number]) {
    const end = new Date();
    const start = new Date(end.getTime() - option.hours * 60 * 60 * 1000);
    setDate({ from: start, to: end });
    onChange({ from: start.toISOString(), to: end.toISOString() });
  }

  function clearAll() {
    setDate(undefined);
    onChange({ from: undefined, to: undefined });
  }

  function commitRange(next: DateRange | undefined, nextFrom = from, nextTo = to) {
    setDate(next);
    if (!next?.from) {
      onChange({ from: undefined, to: undefined });
      return;
    }
    if (!next.to) return;
    onChange({
      from: withTimeOfDay(next.from, nextFrom, false).toISOString(),
      to: withTimeOfDay(next.to, nextTo, true).toISOString(),
    });
  }

  function patchTime(which: 'from' | 'to', timeValue: string) {
    const base = which === 'from' ? parseDate(from) : parseDate(to);
    if (!base || !timeValue) return;
    const [hours, minutes] = timeValue.split(':').map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
    const next = new Date(base);
    next.setHours(hours, minutes, which === 'to' ? 59 : 0, which === 'to' ? 999 : 0);
    if (which === 'from') onChange({ from: next.toISOString(), to });
    else onChange({ from, to: next.toISOString() });
  }

  return (
    <Field className={cn('w-auto gap-0', className)}>
      <FieldLabel htmlFor={fieldId} className="sr-only">{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            variant="outline"
            className="max-w-full min-w-52 justify-start px-2.5 font-normal sm:min-w-60"
          >
            <CalendarIcon data-icon="inline-start" />
            {rangeLabel(from, to, selectedQuick)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-24px)] p-0" align="start">
          <div className={cn('flex', mobile ? 'flex-col' : 'flex-row')}>
            <div className={cn(
              'flex gap-1 border-border p-3',
              mobile ? 'flex-row flex-wrap border-b' : 'w-36 flex-col border-r',
            )}>
              <span className="mb-1 px-2 text-xs font-medium text-muted-foreground">快捷范围</span>
              {quickRanges.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={selectedQuick === item.value ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => applyQuick(item)}
                >
                  {item.label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={!from && !to ? 'secondary' : 'ghost'}
                className="justify-start"
                onClick={clearAll}
              >
                全部时间
              </Button>
            </div>
            <div className="flex flex-col">
              <Calendar
                locale={zhCN}
                mode="range"
                numberOfMonths={1}
                defaultMonth={date?.from ?? date?.to}
                selected={date}
                onSelect={(next) => commitRange(next)}
              />
              <FieldGroup className="grid gap-3 border-t p-3 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor={`${fieldId}-from-time`}>开始时间</FieldLabel>
                  <Input
                    id={`${fieldId}-from-time`}
                    type="time"
                    step={60}
                    value={timeInputValue(from)}
                    disabled={!from}
                    onChange={(event) => patchTime('from', event.target.value)}
                    className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor={`${fieldId}-to-time`}>结束时间</FieldLabel>
                  <Input
                    id={`${fieldId}-to-time`}
                    type="time"
                    step={60}
                    value={timeInputValue(to)}
                    disabled={!to}
                    onChange={(event) => patchTime('to', event.target.value)}
                    className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </Field>
              </FieldGroup>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}

function rangeFromProps(from?: string, to?: string): DateRange | undefined {
  const start = parseDate(from);
  const end = parseDate(to);
  return start || end ? { from: start, to: end } : undefined;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function rangeLabel(from?: string, to?: string, quick?: QuickRange) {
  if (!from && !to) return '全部时间';
  const quickLabel = quickRanges.find((item) => item.value === quick)?.label;
  if (quickLabel) return quickLabel;
  const start = parseDate(from);
  const end = parseDate(to);
  if (start && end) return `${format(start, 'yyyy-MM-dd HH:mm')} - ${format(end, 'yyyy-MM-dd HH:mm')}`;
  return start ? `从 ${format(start, 'yyyy-MM-dd HH:mm')}` : `至 ${format(end!, 'yyyy-MM-dd HH:mm')}`;
}

function withTimeOfDay(date: Date, existing: string | undefined, endOfDay: boolean) {
  const result = new Date(date);
  const current = parseDate(existing);
  if (current) result.setHours(current.getHours(), current.getMinutes(), endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  else if (endOfDay) result.setHours(23, 59, 59, 999);
  else result.setHours(0, 0, 0, 0);
  return result;
}

function timeInputValue(value?: string) {
  const date = parseDate(value);
  return date ? format(date, 'HH:mm') : '';
}

function quickRangeFromValues(from?: string, to?: string): QuickRange | undefined {
  const start = parseDate(from)?.getTime();
  const end = parseDate(to)?.getTime();
  if (start === undefined || end === undefined || end <= start) return undefined;
  const hours = (end - start) / (60 * 60 * 1000);
  return quickRanges.find((item) => Math.abs(item.hours - hours) < 0.02)?.value;
}
