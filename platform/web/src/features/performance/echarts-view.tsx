import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
} from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, SetOptionOpts } from 'echarts/core';
import type { WorkbenchChartOption } from './echarts-panel';

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

export function EchartsView({
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
