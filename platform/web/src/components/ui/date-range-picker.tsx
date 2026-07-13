import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from './button';
import { Calendar } from './calendar';
import { Field, FieldLabel } from './field';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../shared/formatting/cn';
import { useIsMobile } from '../../shared/hooks/use-mobile';

/**
 * shadcn DatePickerWithRange baseline (Calendar + Popover + Field).
 * Business only: ISO URL props, zh label, mobile month count.
 * Radix uses `asChild` (not base-ui `render`).
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  className,
  label = '时间范围',
}: {
  from?: string;
  to?: string;
  onChange: (value: { from?: string; to?: string }) => void;
  className?: string;
  label?: string;
}) {
  const mobile = useIsMobile();
  const [date, setDate] = React.useState<DateRange | undefined>(() => rangeFromProps(from, to));

  React.useEffect(() => {
    setDate(rangeFromProps(from, to));
  }, [from, to]);

  return (
    <Field className={cn('w-auto gap-0', className)}>
      <FieldLabel htmlFor="date-picker-range" className="sr-only">
        {label}
      </FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date-picker-range"
            variant="outline"
            className="min-w-60 justify-start px-2.5 font-normal"
          >
            <CalendarIcon data-icon="inline-start" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'yyyy-MM-dd')} - {format(date.to, 'yyyy-MM-dd')}
                </>
              ) : (
                format(date.from, 'yyyy-MM-dd')
              )
            ) : (
              <span>全部时间</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(next) => {
              setDate(next);
              // Commit to URL only when cleared or range is complete — never discard half-selection.
              if (!next?.from) {
                onChange({ from: undefined, to: undefined });
                return;
              }
              if (!next.to) return;
              const end = new Date(next.to);
              end.setHours(23, 59, 59, 999);
              onChange({
                from: startOfDay(next.from).toISOString(),
                to: end.toISOString(),
              });
            }}
            numberOfMonths={mobile ? 1 : 2}
          />
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

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
