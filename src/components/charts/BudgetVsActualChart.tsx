import { useMemo } from 'react';
import { barY, defineChart, group } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react';
import { colorLegend } from '@tanstack/charts/legend';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scaleOrdinal } from '@tanstack/charts/scales/ordinal';
import { tooltip } from '@tanstack/charts/tooltip';
import { formatCurrency } from '@/lib/utils';

export interface BudgetVsActualItem {
  name: string;
  Planeado: number;
  Real: number;
}

interface BudgetVsActualChartProps {
  data: BudgetVsActualItem[];
}

type SeriesName = 'Planeado' | 'Real';

interface BudgetRow {
  name: string;
  series: SeriesName;
  amount: number;
}

const SERIES_COLORS: Record<SeriesName, string> = {
  Planeado: '#6366f1',
  Real: '#0ea5e9',
};

export function BudgetVsActualChart({ data }: BudgetVsActualChartProps) {
  const definition = useMemo(() => {
    const rows: BudgetRow[] = data.flatMap((item) => [
      { name: item.name, series: 'Planeado' as const, amount: item.Planeado },
      { name: item.name, series: 'Real' as const, amount: item.Real },
    ]);

    return defineChart({
      marks: [
        barY(rows, {
          x: 'name',
          y: 'amount',
          color: 'series',
          layout: group({ padding: 0.1 }),
          maxThickness: 36,
          radius: { end: 4 },
        }),
      ],
      scales: {
        x: { scale: () => scaleBand<string>().padding(0.2) },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: { ticks: { format: (value) => formatCurrency(Number(value)) } },
        },
      },
      color: {
        scale: scaleOrdinal<string, string>()
          .domain(['Planeado', 'Real'])
          .range([SERIES_COLORS.Planeado, SERIES_COLORS.Real]),
        legend: colorLegend({ placement: 'top' }),
      },
      tooltip: {
        use: tooltip,
        format: (point) =>
          `${point.datum.name} · ${point.datum.series}: ${formatCurrency(point.datum.amount)}`,
      },
    });
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 text-slate-400 dark:text-slate-500 text-sm">
        No hay datos de presupuesto disponibles.
      </div>
    );
  }

  return (
    <div
      className="w-full text-slate-500 dark:text-slate-400"
      data-testid="budget-vs-actual-chart"
    >
      <Chart
        definition={definition}
        height={256}
        ariaLabel="Presupuesto planeado frente a gasto real por categoría"
      />
    </div>
  );
}
