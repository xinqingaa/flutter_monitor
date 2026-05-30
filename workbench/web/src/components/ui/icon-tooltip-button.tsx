import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button, type ButtonProps } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export function IconTooltipButton({
  label,
  icon: Icon,
  children,
  ...props
}: Omit<ButtonProps, 'children'> & {
  label: string;
  icon: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} title={label} {...props}>
          <Icon className="size-4" />
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
