import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../shared/formatting/cn';

export interface FilterSelectOption {
  value: string;
  label: string;
  triggerLabel?: string;
}

/** Sentinel for "all / unset" — business URL filter exception; not a real dimension value. */
const EMPTY_VALUE = '__flutter_monitor_select_all__';

export function FilterSelect({
  value,
  placeholder,
  options,
  onChange,
  className,
  ariaLabel,
}: {
  value?: string;
  placeholder: string;
  options: FilterSelectOption[];
  onChange: (value?: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const selected = value ? options.find((option) => option.value === value) : undefined;

  return (
    <SelectPrimitive.Root
      value={value ?? EMPTY_VALUE}
      onValueChange={(next) => onChange(next === EMPTY_VALUE ? undefined : next)}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          <span className="block min-w-0 max-w-full truncate">
            {selected?.triggerLabel ?? selected?.label ?? placeholder}
          </span>
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          )}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport
            className={cn(
              'p-1',
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
            )}
          >
            <SelectPrimitive.Group>
              <SelectItem value={EMPTY_VALUE}>{placeholder}</SelectItem>
              {options
                .filter((option) => option.value.length > 0 && option.value !== EMPTY_VALUE)
                .map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
            </SelectPrimitive.Group>
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectScrollUpButton() {
  return (
    <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
      <ChevronUp />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton() {
  return (
    <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
      <ChevronDown />
    </SelectPrimitive.ScrollDownButton>
  );
}
