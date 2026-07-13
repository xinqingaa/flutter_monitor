import { Badge } from '../../components/common/status-badge';
import type { MonitorEvent } from '../../shared/datasource/types';
import { eventDisplay } from '../../shared/event-model/display';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

export function EventKindBadge({ event }: { event: MonitorEvent }) {
  const display = eventDisplay(event);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge tone={display.signalTone}>{display.signalType}</Badge>
      </TooltipTrigger>
      <TooltipContent>{display.signalDescription}</TooltipContent>
    </Tooltip>
  );
}
