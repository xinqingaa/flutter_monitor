import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../../shared/formatting/cn';

export interface SelectOption {
  value: string;
  label: string;
  triggerLabel?: string;
}

const EMPTY_VALUE = '__flutter_monitor_select_all__';

export function Select({
  value,
  placeholder,
  options,
  onChange,
  className,
  ariaLabel,
}: {
  value?: string;
  placeholder: string;
  options: SelectOption[];
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
          'inline-flex h-8 min-w-[128px] max-w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition-colors hover:bg-zinc-50 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 data-[placeholder]:text-zinc-500',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          <span className="block min-w-0 max-w-full truncate whitespace-nowrap">{selected?.triggerLabel ?? selected?.label}</span>
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-zinc-400" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[320px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          <SelectPrimitive.Viewport className="p-1">
            <SelectItem value={EMPTY_VALUE}>{placeholder}</SelectItem>
            {options
              .filter((option) => option.value.length > 0 && option.value !== EMPTY_VALUE)
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function SelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex min-h-8 cursor-pointer select-none items-center rounded px-7 py-1.5 text-sm text-zinc-800 outline-none data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-900"
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
        <Check className="size-4 text-teal-600" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
