import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface ExpenseData {
  name: string;
  value: number;
  color: string;
}

interface ExpenseBarChartProps {
  data: ExpenseData[];
}

export function ExpenseBarChart({ data }: ExpenseBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500 text-sm">
        No hay datos para mostrar.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} opacity={0.3} />
          <XAxis 
            type="number" 
            tickFormatter={(value) => formatCurrency(value)}
            style={{ fontSize: '10px' }}
            stroke="#94a3b8"
          />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={100} 
            style={{ fontSize: '12px' }}
            stroke="#94a3b8"
            tick={{ fill: '#64748b' }}
          />
          <Tooltip
            formatter={(value: any) => formatCurrency(Number(value))}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
            itemStyle={{ color: '#0f172a' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
