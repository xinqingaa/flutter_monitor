import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { DimensionOption } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';

function sameValues(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * Multi-value Combobox for remote dimension suggestions (userId / sessionId).
 * Draft edits while open; commits once when the popover closes.
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
  const committed = values ?? [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(() => values ?? []);

  // Sync draft from props only when closed. Compare by value so `values ?? []`
  // (new [] each render when unset) does not trigger Maximum update depth.
  useEffect(() => {
    if (open) return;
    const next = values ?? [];
    setDraft((current) => (sameValues(current, next) ? current : next));
  }, [values, open]);

  const selected = open ? draft : committed;
  const selectedSet = new Set(selected);
  const triggerLabel = selected.length === 0
    ? `全部${label}`
    : selected.length === 1
      ? selected[0]
      : `${label} ${selected.length}`;

  function toggle(value: string) {
    setDraft((current) => {
      const set = new Set(current);
      const next = set.has(value)
        ? current.filter((item) => item !== value)
        : [...current, value].sort((a, b) => a.localeCompare(b));
      return next;
    });
  }

  function clearDraft() {
    setDraft([]);
    onQueryChange('');
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (!sameValues(draft, committed)) onChange(draft.length > 0 ? draft : undefined);
    } else {
      setDraft(committed);
    }
    setOpen(nextOpen);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn(
            'min-w-0 max-w-full justify-between overflow-hidden font-normal focus-visible:ring-0',
            selected.length === 0 && 'text-muted-foreground',
            className,
          )}
        >
          <span className={cn('min-w-0 truncate', selected.length > 0 && 'font-mono')}>
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
                  <CommandItem value="__clear__" onSelect={clearDraft}>
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
