import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../shared/formatting/cn';
import type { FilterSelectOption } from './filter-select';

function sameValues(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function MultiSelect({
  values,
  placeholder,
  options,
  onChange,
  className,
  contentClassName,
  ariaLabel,
  open: openProp,
  onOpenChange,
}: {
  values?: string[];
  placeholder: string;
  options: FilterSelectOption[];
  onChange: (values?: string[]) => void;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const committed = values ?? [];
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
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
  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find((option) => option.value === selected[0])?.triggerLabel
        ?? options.find((option) => option.value === selected[0])?.label
        ?? selected[0])
      : `${placeholder.replace(/^全部/, '')} ${selected.length}`;

  function toggle(value: string, checked: boolean) {
    setDraft((current) => {
      const next = checked
        ? [...current, value].sort((a, b) => a.localeCompare(b))
        : current.filter((item) => item !== value);
      return next;
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      const next = draft.length > 0 ? draft : undefined;
      if (!sameValues(draft, committed)) onChange(next);
    } else {
      setDraft(committed);
    }
    if (openProp === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            'h-9 min-w-[104px] max-w-full justify-between font-normal focus-visible:ring-0',
            selected.length === 0 && 'text-muted-foreground',
            className,
          )}
        >
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown data-icon="inline-end" className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          'max-h-80 min-w-[var(--radix-dropdown-menu-trigger-width)] w-max max-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto',
          contentClassName,
        )}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{placeholder}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">暂无选项</div>
          ) : (
            options
              .filter((option) => option.value.length > 0)
              .map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={selectedSet.has(option.value)}
                  onCheckedChange={(checked) => toggle(option.value, checked === true)}
                  onSelect={(event) => event.preventDefault()}
                  className="items-start"
                >
                  <span className="break-all whitespace-normal leading-5">{option.label}</span>
                </DropdownMenuCheckboxItem>
              ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

