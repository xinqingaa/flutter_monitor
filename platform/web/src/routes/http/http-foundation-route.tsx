import { Activity } from 'lucide-react';
import { SplitPane } from '../../components/layout/split-pane';

export function HttpFoundationRoute() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default bg-surface px-4">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-6 text-text-primary">HTTP 请求</h1>
          <p className="truncate text-xs leading-[18px] text-text-secondary">最近完成的客户端请求</p>
        </div>
      </header>
      <div className="h-12 shrink-0 border-b border-border-default bg-surface" />
      <SplitPane
        primary={<div className="grid h-full place-items-center text-sm text-text-muted">暂无 HTTP 请求</div>}
        secondary={(
          <div className="grid h-full place-items-center p-6 text-center text-sm text-text-muted">
            <div><Activity className="mx-auto mb-2 size-5" />选择一行查看摘要</div>
          </div>
        )}
      />
    </div>
  );
}
