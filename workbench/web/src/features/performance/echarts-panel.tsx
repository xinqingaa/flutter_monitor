import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  type BarSeriesOption,
  type LineSeriesOption,
  type PieSeriesOption,
  type ScatterSeriesOption,
} from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  type DataZoomComponentOption,
  type GridComponentOption,
  type LegendComponentOption,
  type MarkLineComponentOption,
  type TitleComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption, ECharts, SetOptionOpts } from 'echarts/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { EmptyState } from '../../components/common/empty-state';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

echarts.use([
  BarChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  LineChart,
  MarkLineComponent,
  PieChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

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
          <EchartsView option={option} height={height} onClick={onClick} />
        )}
      </CardContent>
    </Card>
  );
}

function EchartsView({
  option,
  height,
  onClick,
}: {
  option: WorkbenchChartOption;
  height: number;
  onClick?: (params: unknown) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const stableOption = useMemo(() => option, [option]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const chart = chartRef.current ?? echarts.init(element, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const setOptions: SetOptionOpts = { notMerge: true, lazyUpdate: false };
    chart.setOption(stableOption, setOptions);

    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [stableOption]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onClick) return undefined;
    const handler = (params: unknown) => onClick(params);
    chart.on('click', handler);
    return () => {
      chart.off('click', handler);
    };
  }, [onClick]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return <div ref={ref} className="min-w-0" style={{ height }} />;
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
