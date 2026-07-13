import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Button } from '../../components/ui/button';
import { cn } from '../../shared/formatting/cn';

export function SortableHeader({
  label,
  active,
  direction,
  align = 'left',
  onClick,
}: {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  align?: 'left' | 'right';
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        '-ml-2 h-8 px-2 font-medium',
        align === 'right' && 'ml-auto -mr-2',
      )}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {label}
      <Icon data-icon="inline-end" className={cn(!active && 'opacity-40')} />
    </Button>
  );
}
