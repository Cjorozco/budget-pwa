import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExpensePieChart } from '@/components/charts/ExpensePieChart';
import { PieChartIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function Reports() {
  const reportData = useLiveQuery(async () => {
    const now = new Date();
    const start = startOfMonth(now).getTime();
    const end = endOfMonth(now).getTime();

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
    const chartData = Object.entries(aggregated)
      .map(([categoryId, amount]) => {
        const category = catMap.get(categoryId);
        return {
          name: category?.name || 'Sin Categoría',
          value: amount,
          color: category?.color || '#94a3b8'
        };
      })
      // Sort to show largest expenses first
      .sort((a, b) => b.value - a.value);

    return { chartData, totalExpense };
  });

  const isLoading = !reportData;

  return (
    <div className="p-4 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Informes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {format(new Date(), "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <PieChartIcon className="text-slate-600 dark:text-slate-300" size={20} />
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
          ) : (
            <ExpensePieChart data={reportData.chartData} />
          )}
        </div>
      </section>
    </div>
  );
}
