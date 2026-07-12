import * as TabsPrimitive from '@radix-ui/react-tabs';
import type * as React from 'react';
import { cn } from '../../shared/formatting/cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex h-8 w-max items-center rounded-control border border-border-default bg-subtle p-0.5', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-control px-2.5 text-xs font-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-interactive-focusRing data-[state=active]:bg-surface data-[state=active]:text-text-primary data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('min-h-0 outline-none', className)} {...props} />;
}
