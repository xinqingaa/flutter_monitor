import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../../shared/formatting/cn';

const badgeVariants = cva(
  'inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-zinc-200 bg-zinc-50 text-zinc-700',
        good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: 'border-blue-200 bg-blue-50 text-blue-700',
        warn: 'border-amber-200 bg-amber-50 text-amber-800',
        danger: 'border-red-200 bg-red-50 text-red-700',
        purple: 'border-violet-200 bg-violet-50 text-violet-700',
        teal: 'border-teal-200 bg-teal-50 text-teal-700',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
