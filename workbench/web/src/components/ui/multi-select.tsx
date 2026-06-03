import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../../shared/formatting/cn';
import type { SelectOption } from './select';

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
  options: SelectOption[];
  onChange: (values?: string[]) => void;
  className?: string;
  ariaLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const selected = values ?? [];
  const selectedSet = new Set(selected);
  const label = selected.length === 0 ? placeholder : `${placeholder.replace(/^全部/, '')} ${selected.length}`;

  function toggle(value: string) {
    const next = selectedSet.has(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value].sort((a, b) => a.localeCompare(b));
    onChange(next.length > 0 ? next : undefined);
  }

  return (
    <SelectPrimitive.Root value="" open={open} onOpenChange={onOpenChange} onValueChange={toggle}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel ?? placeholder}
        onMouseDown={() => onOpenChange?.(true)}
        className={cn(
          'inline-flex h-8 min-w-[128px] max-w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition-colors hover:bg-zinc-50 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 data-[placeholder]:text-zinc-500',
          selected.length === 0 && 'text-zinc-500',
          className,
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
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
            {options.length === 0 ? (
              <div className="px-2 py-2 text-sm text-zinc-400">暂无选项</div>
            ) : options
              .filter((option) => option.value.length > 0)
              .map((option) => (
                <SelectItem key={option.value} value={option.value} checked={selectedSet.has(option.value)}>
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
  checked,
  children,
}: {
  value: string;
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex min-h-8 cursor-pointer select-none items-center rounded px-7 py-1.5 text-sm text-zinc-800 outline-none data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-900"
    >
      <span className="absolute left-2 inline-flex items-center">
        {checked ? <Check className="size-4 text-teal-600" /> : null}
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
