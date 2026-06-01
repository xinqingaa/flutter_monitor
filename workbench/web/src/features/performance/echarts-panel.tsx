import { lazy, Suspense } from 'react';
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption, ScatterSeriesOption } from 'echarts/charts';
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import type { ComposeOption } from 'echarts/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { EmptyState } from '../../components/common/empty-state';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

const LazyEchartsView = lazy(() => import('./echarts-view').then((module) => ({ default: module.EchartsView })));

export type WorkbenchChartOption = ComposeOption<
  | BarSeriesOption
  | DataZoomComponentOption
  | GridComponentOption
  | LegendComponentOption
  | LineSeriesOption
  | MarkLineComponentOption
  | PieSeriesOption
  | ScatterSeriesOption
  | TitleComponentOption
  | TooltipComponentOption
>;

export function EchartsPanel({
  title,
  description,
  source,
  option,
  empty,
  height = 280,
  onClick,
}: {
  title: string;
  description: string;
  source: string;
  option?: WorkbenchChartOption;
  empty?: boolean;
  height?: number;
  onClick?: (params: unknown) => void;
}) {
  return (
    <Card className="grid min-h-[260px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <SourceBadge source={source} />
      </CardHeader>
      <CardContent className="min-h-0">
        {empty || !option ? (
          <EmptyState title="暂无可画数据" description="SDK 没有提供对应字段时，Workbench 不会补造图表数据。" />
        ) : (
          <Suspense fallback={<ChartLoading height={height} />}>
            <LazyEchartsView option={option} height={height} onClick={onClick} />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
}

function ChartLoading({ height }: { height: number }) {
  return (
    <div
      className="grid min-w-0 place-items-center rounded-md border border-zinc-100 bg-zinc-50 text-xs text-zinc-500"
      style={{ height }}
    >
      图表加载中
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge tone="teal" className="cursor-help rounded-md">来源字段</Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="max-w-[320px] text-zinc-300">{source}</div>
      </TooltipContent>
    </Tooltip>
  );
}
