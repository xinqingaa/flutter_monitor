import { Link, useLocation } from '@tanstack/react-router';
import { Activity, AlertTriangle, Gauge, Globe2, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../shared/formatting/cn';

const tabs: Array<{ to: '/startup' | '/pages' | '/network' | '/jank' | '/errors'; label: string; icon: LucideIcon }> = [
  { to: '/startup', label: '启动链路', icon: Rocket },
  { to: '/pages', label: '页面性能', icon: Gauge },
  { to: '/network', label: '网络请求', icon: Globe2 },
  { to: '/jank', label: '卡顿', icon: Activity },
  { to: '/errors', label: '错误', icon: AlertTriangle },
];

export function PerformanceTabs() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-10 overflow-x-auto border-b border-zinc-200 bg-zinc-100/95 px-2 py-2 backdrop-blur">
      <div className="inline-flex min-w-max items-center rounded-md border border-zinc-200 bg-white p-0.5">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              search
              className={cn(
                'inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 text-sm font-medium text-zinc-600 transition-colors',
                active && 'bg-zinc-950 text-white [&_*]:text-white',
                !active && 'hover:bg-zinc-50 hover:text-zinc-950',
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
