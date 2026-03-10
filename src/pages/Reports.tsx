import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { startOfMonth, endOfMonth, format, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExpensePieChart } from '@/components/charts/ExpensePieChart';
import { ExpenseBarChart } from '@/components/charts/ExpenseBarChart';
import { PieChartIcon, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, adjustColor } from '@/lib/utils';

export default function Reports() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  const reportData = useLiveQuery(async () => {
    const start = startOfMonth(currentDate).getTime();
    const end = endOfMonth(currentDate).getTime();

    const txs = await db.transactions
      .where('date')
      .between(start, end)
      .toArray();

    // 1. Fetch categories for colors and names
    const cats = await db.categories.toArray();
    const catMap = new Map(cats.map(c => [c.id, c]));

    // 2. Filter valid expenses (no transfers, only expenses)
    const expenses = txs.filter(t => t.type === 'expense');

    // 3. Aggregate by category
    const aggregated: Record<string, number> = {};
    let totalExpense = 0;

    expenses.forEach(tx => {
      const current = aggregated[tx.categoryId] || 0;
      aggregated[tx.categoryId] = current + tx.amount;
      totalExpense += tx.amount;
    });

    // 4. Format for Recharts
    const usedColors: Record<string, number> = {};
    const chartData = Object.entries(aggregated)
      .sort(([, a], [, b]) => b - a)
      .map(([categoryId, amount]) => {
        const category = catMap.get(categoryId);
        let baseColor = category?.color || '#94a3b8';
        
        if (usedColors[baseColor] !== undefined) {
           usedColors[baseColor] += 1;
           const shift = usedColors[baseColor] % 2 === 1 
              ? 40 * Math.ceil(usedColors[baseColor] / 2) 
              : -40 * (usedColors[baseColor] / 2);
           baseColor = adjustColor(baseColor, shift);
        } else {
           usedColors[baseColor] = 0;
        }

        return {
          name: category?.name || 'Sin Categoría',
          value: amount,
          color: baseColor
        };
      });

    return { chartData, totalExpense };
  }, [currentDate]);

  const isLoading = !reportData;

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  return (
    <div className="p-4 space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Informes</h1>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-full p-1">
            <button
              onClick={() => setChartType('pie')}
              className={`p-2 rounded-full transition-all ${chartType === 'pie' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
              title="Gráfico circular"
            >
              <PieChartIcon size={18} />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-2 rounded-full transition-all ${chartType === 'bar' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
              title="Gráfico de barras"
            >
              <BarChart2 size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <button 
            onClick={() => navigateMonth('prev')}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </span>
          <button 
            onClick={() => navigateMonth('next')}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      <section className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex flex-col">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
            Gastos por Categoría
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Total mes: <span className="font-bold text-slate-900 dark:text-white">
              {isLoading ? "..." : formatCurrency(reportData.totalExpense)}
            </span>
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center animate-pulse gap-2">
              <div className="w-40 h-40 rounded-full border-8 border-slate-100 dark:border-slate-800"></div>
            </div>
          ) : chartType === 'pie' ? (
            <ExpensePieChart data={reportData.chartData} />
          ) : (
            <ExpenseBarChart data={reportData.chartData} />
          )}
        </div>
      </section>
    </div>
  );
}
