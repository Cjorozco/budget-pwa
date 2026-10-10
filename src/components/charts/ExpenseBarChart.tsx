import { useMemo } from 'react';
import { barX, defineChart } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { formatCurrency } from '@/lib/utils';

export interface CategoryChartData {
  name: string;
  parentName?: string;
  value: number;
  color: string;
  percentage?: number;
}

interface ExpenseBarChartProps {
  data: CategoryChartData[];
  emptyMessage?: string;
}

export function ExpenseBarChart({ data, emptyMessage = 'No hay datos para mostrar.' }: ExpenseBarChartProps) {
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barX(data, {
            x: 'value',
            y: 'name',
            fill: (d) => d.color,
            radius: { end: 4 },
            maxThickness: 30,
          }),
        ],
        scales: {
          x: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { ticks: { format: (value) => formatCurrency(Number(value)) } },
          },
          y: {
            scale: () =>
              scaleBand<string>()
                .domain(data.map((d) => d.name))
                .padding(0.25),
          },
        },
        tooltip: {
          use: tooltip,
          format: (point) => {
            const { name, parentName, value } = point.datum;
            const formatted = formatCurrency(value);
            return parentName
              ? `${name}: ${formatted} (${parentName})`
              : `${name}: ${formatted}`;
          },
        },
      }),
    [data],
  );

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  // 45px per bar, minimum 256px
  const chartHeight = Math.max(256, data.length * 45);

  return (
    <div
      data-testid="expense-chart"
      className="w-full overflow-y-auto pr-2 text-slate-500 dark:text-slate-400"
      style={{ maxHeight: '420px', minWidth: 280 }}
    >
      <Chart
        definition={definition}
        height={chartHeight}
        ariaLabel="Gasto por categoría"
      />
    </div>
  );
}
