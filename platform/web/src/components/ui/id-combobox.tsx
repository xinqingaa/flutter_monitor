import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import type { DimensionOption } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';

export function IdCombobox({ value, label, query, options, loading, error, onQueryChange, onChange, className }: {
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
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="outline" role="combobox" aria-expanded={open} aria-label={label} className={cn('h-9 min-w-36 justify-between border-border-default bg-surface px-3 text-xs font-normal shadow-none focus-visible:ring-2 focus-visible:ring-interactive-focusRing', className)}>
        <span className={cn('truncate font-mono', !value && 'font-sans text-text-secondary')}>{value ?? `全部${label}`}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-text-muted" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[min(360px,calc(100vw-24px))] p-0">
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={onQueryChange} placeholder={`模糊查找${label}`} />
        <CommandList>
          {loading ? <div className="p-3 text-xs text-text-secondary">正在查询真实候选...</div> : null}
          {error ? <div className="p-3 text-xs text-status-danger">候选加载失败</div> : null}
          {!loading && !error && options.length === 0 ? <CommandEmpty>没有匹配候选</CommandEmpty> : null}
          <CommandGroup>
            {value ? <CommandItem value="__clear__" onSelect={() => { onChange(undefined); onQueryChange(''); setOpen(false); }}><X />清除当前条件</CommandItem> : null}
            {options.map((option) => <CommandItem key={option.value} value={option.value} onSelect={() => { onChange(option.value); onQueryChange(option.value); setOpen(false); }}>
              <Check className={cn('size-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
              <span className="min-w-0 flex-1 truncate font-mono">{option.value}</span>
              <span className="text-xs tabular-nums text-text-muted">{option.count}</span>
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
