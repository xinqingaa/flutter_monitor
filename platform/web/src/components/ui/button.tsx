import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../../shared/formatting/cn';

const buttonVariants = cva(
  'inline-flex h-9 items-center justify-center gap-2 rounded-control border px-3 text-sm font-medium transition-colors duration-[120ms] outline-none focus-visible:ring-2 focus-visible:ring-interactive-focusRing disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'border-accent-default bg-accent-default text-text-inverse hover:border-accent-hover hover:bg-accent-hover [&_*]:text-text-inverse',
        secondary: 'border-border-default bg-surface text-text-primary hover:bg-subtle [&_*]:text-text-primary',
        ghost: 'border-transparent bg-transparent text-text-secondary hover:bg-subtle [&_*]:text-text-secondary',
        danger: 'border-status-danger bg-status-danger-subtle text-status-danger hover:brightness-95 [&_*]:text-status-danger',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-8 px-2 text-xs',
        icon: 'h-9 w-9 px-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
