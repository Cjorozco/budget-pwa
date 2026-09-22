import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/utils';

export interface BudgetVsActualItem {
  name: string;
  Planeado: number;
  Real: number;
}

interface BudgetVsActualChartProps {
  data: BudgetVsActualItem[];
}

export function BudgetVsActualChart({ data }: BudgetVsActualChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 text-slate-400 dark:text-slate-500 text-sm">
        No hay datos de presupuesto disponibles.
      </div>
    );
  }

  return (
    <div className="w-full h-64" data-testid="budget-vs-actual-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 15, right: 15, left: -5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#94a3b8"
            style={{ fontSize: '12px', fontWeight: 500 }}
            tick={{ fill: '#64748b' }}
          />
          <YAxis
            stroke="#94a3b8"
            style={{ fontSize: '10px' }}
            tickFormatter={(val) => formatCurrency(val)}
            tick={{ fill: '#64748b' }}
            width={85}
          />
          <Tooltip
            formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
            contentStyle={{
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
          />
          <Bar
            dataKey="Planeado"
            fill="#6366f1"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            dataKey="Real"
            fill="#0ea5e9"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
