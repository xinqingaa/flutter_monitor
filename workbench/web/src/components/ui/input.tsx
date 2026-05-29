import type * as React from 'react';
import { cn } from '../../shared/formatting/cn';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100',
        className,
      )}
      {...props}
    />
  );
}
