import { Activity, Database, HeartPulse, Radio } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { formatDateTime } from '../../shared/formatting/format';

export function ServiceStatusStrip({ health, live }: { health?: Record<string, unknown>; live: boolean }) {
  return (
    <Card className="grid grid-cols-4 overflow-hidden">
      <StatusCell icon={Database} label="storage" value={String(health?.storageMode ?? '-')} />
      <StatusCell icon={Activity} label="events" value={String(health?.eventCount ?? 0)} />
      <StatusCell icon={HeartPulse} label="sessions" value={String(health?.sessionCount ?? 0)} />
      <StatusCell icon={Radio} label="live" value={live ? 'connected' : 'paused'} detail={formatDateTime(health?.lastIngestAt as string | undefined)} />
    </Card>
  );
}

function StatusCell({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_1fr] gap-x-2 gap-y-0 border-r border-zinc-200 px-3 py-2 last:border-r-0">
      <Icon className="row-span-2 mt-0.5 size-4 text-zinc-500" />
      <span className="text-[11px] uppercase text-zinc-500">{label}</span>
      <strong className="min-w-0 truncate text-[13px] text-zinc-950">{detail && detail !== '-' ? `${value} · ${detail}` : value}</strong>
    </div>
  );
}
