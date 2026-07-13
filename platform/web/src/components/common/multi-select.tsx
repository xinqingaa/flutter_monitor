import { ChevronDown } from 'lucide-react';
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

export function MultiSelect({
  values,
  placeholder,
  options,
  onChange,
  className,
  ariaLabel,
  open,
  onOpenChange,
}: {
  values?: string[];
  placeholder: string;
  options: FilterSelectOption[];
  onChange: (values?: string[]) => void;
  className?: string;
  ariaLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const selected = values ?? [];
  const selectedSet = new Set(selected);
  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find((option) => option.value === selected[0])?.triggerLabel
        ?? options.find((option) => option.value === selected[0])?.label
        ?? selected[0])
      : `${placeholder.replace(/^全部/, '')} ${selected.length}`;

  function toggle(value: string, checked: boolean) {
    const next = checked
      ? [...selected, value].sort((a, b) => a.localeCompare(b))
      : selected.filter((item) => item !== value);
    onChange(next.length > 0 ? next : undefined);
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            'h-9 min-w-[128px] max-w-full justify-between font-normal focus-visible:ring-0',
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
        className="max-h-80 min-w-[var(--radix-dropdown-menu-trigger-width)] w-56 overflow-y-auto"
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
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
