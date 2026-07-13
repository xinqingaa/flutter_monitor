import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { DimensionOption } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';

/**
 * Business Combobox: remote dimension suggestions + URL value.
 * Interaction follows shadcn Combobox (Popover + Command); only query/data wiring is custom.
 */
export function IdCombobox({
  value,
  label,
  query,
  options,
  loading,
  error,
  onQueryChange,
  onChange,
  className,
}: {
  value?: string;
  label: string;
  query: string;
  options: DimensionOption[];
  loading?: boolean;
  error?: boolean;
  onQueryChange: (value: string) => void;
  onChange: (value?: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn('min-w-36 justify-between font-normal', className)}
        >
          <span className={cn('truncate font-mono', !value && 'font-sans text-muted-foreground')}>
            {value ?? `全部${label}`}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-24px))] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={onQueryChange} placeholder={`模糊查找${label}`} />
          <CommandList>
            {loading ? <CommandEmpty>正在查询真实候选...</CommandEmpty> : null}
            {error ? <CommandEmpty>候选加载失败</CommandEmpty> : null}
            {!loading && !error && options.length === 0 ? <CommandEmpty>没有匹配候选</CommandEmpty> : null}
            {!loading && !error ? (
              <CommandGroup>
                {value ? (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onChange(undefined);
                      onQueryChange('');
                      setOpen(false);
                    }}
                  >
                    <X />
                    清除当前条件
                  </CommandItem>
                ) : null}
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onChange(option.value);
                      onQueryChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn(value === option.value ? 'opacity-100' : 'opacity-0')} />
                    <span className="min-w-0 flex-1 truncate font-mono">{option.value}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{option.count}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
