import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { DimensionOption } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';

/**
 * Multi-value Combobox for remote dimension suggestions (userId / sessionId).
 * Follows shadcn Combobox (Popover + Command); keeps panel open while toggling.
 */
export function MultiCombobox({
  values,
  label,
  query,
  options,
  loading,
  error,
  onQueryChange,
  onChange,
  className,
}: {
  values?: string[];
  label: string;
  query: string;
  options: DimensionOption[];
  loading?: boolean;
  error?: boolean;
  onQueryChange: (value: string) => void;
  onChange: (values?: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = values ?? [];
  const selectedSet = new Set(selected);
  const triggerLabel = selected.length === 0
    ? `全部${label}`
    : selected.length === 1
      ? selected[0]
      : `${label} ${selected.length}`;

  function toggle(value: string) {
    const next = selectedSet.has(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value].sort((a, b) => a.localeCompare(b));
    onChange(next.length > 0 ? next : undefined);
  }

  function clear() {
    onChange(undefined);
    onQueryChange('');
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn(
            'min-w-36 justify-between font-normal focus-visible:ring-0',
            selected.length === 0 && 'text-muted-foreground',
            className,
          )}
        >
          <span className={cn('truncate', selected.length > 0 && 'font-mono')}>
            {triggerLabel}
          </span>
          <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-24px))] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={onQueryChange} placeholder={`模糊查找${label}`} />
          <CommandList>
            {loading ? <CommandEmpty>正在查询真实候选...</CommandEmpty> : null}
            {error ? <CommandEmpty>候选加载失败</CommandEmpty> : null}
            {!loading && !error && options.length === 0 && selected.length === 0 ? (
              <CommandEmpty>没有匹配候选</CommandEmpty>
            ) : null}
            {!loading && !error ? (
              <CommandGroup>
                {selected.length > 0 ? (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      clear();
                    }}
                  >
                    <X data-icon="inline-start" />
                    清除当前条件
                  </CommandItem>
                ) : null}
                {selected
                  .filter((value) => !options.some((option) => option.value === value))
                  .map((value) => (
                    <CommandItem
                      key={`selected:${value}`}
                      value={value}
                      onSelect={() => toggle(value)}
                    >
                      <Check data-icon="inline-start" />
                      <span className="min-w-0 truncate font-mono">{value}</span>
                    </CommandItem>
                  ))}
                {options.map((option) => {
                  const checked = selectedSet.has(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => toggle(option.value)}
                    >
                      <Check
                        data-icon="inline-start"
                        className={cn(!checked && 'opacity-0')}
                      />
                      <span className="min-w-0 truncate font-mono">{option.value}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{option.count}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
