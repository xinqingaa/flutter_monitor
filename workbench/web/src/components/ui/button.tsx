import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../../shared/formatting/cn';

const buttonVariants = cva(
  'inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 [&_*]:text-white',
        secondary: 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 [&_*]:text-zinc-900',
        ghost: 'border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100 [&_*]:text-zinc-700',
        danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 [&_*]:text-red-700',
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

export function Button({ className, variant, size, asChild = false, style, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      style={variant === 'default' ? { ...style, color: '#fff' } : style}
      {...props}
    />
  );
}
