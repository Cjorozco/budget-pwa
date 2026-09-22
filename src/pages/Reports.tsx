import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { startOfMonth, endOfMonth, format, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExpenseBarChart, type CategoryChartData } from '@/components/charts/ExpenseBarChart';
import { BudgetVsActualChart, type BudgetVsActualItem } from '@/components/charts/BudgetVsActualChart';
import {
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ListTree,
  Wallet,
} from 'lucide-react';
import { formatCurrency, adjustColor, cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type ReportTab = 'expenses' | 'income' | 'fixed-budget';
type HierarchyView = 'parents' | 'children';

export default function Reports() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<ReportTab>('expenses');
  const [hierarchyView, setHierarchyView] = useState<HierarchyView>('parents');

  const reportData = useLiveQuery(async () => {
    const start = startOfMonth(currentDate).getTime();
    const end = endOfMonth(currentDate).getTime();

    // 1. Fetch transactions for month
    const txs = await db.transactions
      .where('date')
      .between(start, end)
      .toArray();

    // 2. Fetch categories and budget items
    const [cats, budgetItems] = await Promise.all([
      db.categories.toArray(),
      db.budgetItems.toArray(),
    ]);
    const catMap = new Map(cats.map(c => [c.id, c]));

    // 3. Separate expenses and incomes
    const expenses = txs.filter(t => t.type === 'expense');
    const incomes = txs.filter(t => t.type === 'income');

    let totalExpense = 0;
    let totalIncome = 0;

    expenses.forEach(t => { totalExpense += t.amount; });
    incomes.forEach(t => { totalIncome += t.amount; });

    // Helper to aggregate transactions by parents or children
    const aggregateTxs = (
      txList: typeof txs,
      viewMode: HierarchyView
    ): CategoryChartData[] => {
      const aggregated: Record<string, { amount: number; name: string; parentName?: string; color: string }> = {};
      const total = txList.reduce((acc, t) => acc + t.amount, 0);

      txList.forEach(tx => {
        const cat = catMap.get(tx.categoryId);

        if (viewMode === 'parents') {
          // Roll up to parent if exists
          if (cat?.parentId) {
            const parent = catMap.get(cat.parentId);
            const key = parent?.id || cat.parentId;
            if (!aggregated[key]) {
              aggregated[key] = {
                amount: 0,
                name: parent?.name || 'Categoría Principal',
                color: parent?.color || cat.color || '#94a3b8',
              };
            }
            aggregated[key].amount += tx.amount;
          } else if (cat) {
            const key = cat.id;
            if (!aggregated[key]) {
              aggregated[key] = {
                amount: 0,
                name: cat.name,
                color: cat.color || '#94a3b8',
              };
            }
            aggregated[key].amount += tx.amount;
          } else {
            const key = '__uncategorized__';
            if (!aggregated[key]) {
              aggregated[key] = {
                amount: 0,
                name: 'Sin Categoría',
                color: '#94a3b8',
              };
            }
            aggregated[key].amount += tx.amount;
          }
        } else {
          // Specific subcategory/category (children view)
          const key = tx.categoryId || '__uncategorized__';
          if (!aggregated[key]) {
            const parentName = cat?.parentId ? catMap.get(cat.parentId)?.name : undefined;
            aggregated[key] = {
              amount: 0,
              name: cat?.name || 'Sin Categoría',
              parentName,
              color: cat?.color || '#94a3b8',
            };
          }
          aggregated[key].amount += tx.amount;
        }
      });

      const usedColors: Record<string, number> = {};
      return Object.entries(aggregated)
        .sort(([, a], [, b]) => b.amount - a.amount)
        .map(([, item]) => {
          let baseColor = item.color;
          if (usedColors[baseColor] !== undefined) {
            usedColors[baseColor] += 1;
            const shift = usedColors[baseColor] % 2 === 1
              ? 35 * Math.ceil(usedColors[baseColor] / 2)
              : -35 * (usedColors[baseColor] / 2);
            baseColor = adjustColor(baseColor, shift);
          } else {
            usedColors[baseColor] = 0;
          }

          return {
            name: item.name,
            parentName: item.parentName,
            value: item.amount,
            color: baseColor,
            percentage: total > 0 ? (item.amount / total) * 100 : 0,
          };
        });
    };

    const expenseDataParents = aggregateTxs(expenses, 'parents');
    const expenseDataChildren = aggregateTxs(expenses, 'children');
    const incomeDataParents = aggregateTxs(incomes, 'parents');
    const incomeDataChildren = aggregateTxs(incomes, 'children');

    // Fixed Budget calculations
    const fixedExpenses = budgetItems.filter(b => b.type === 'expense');
    const fixedIncomes = budgetItems.filter(b => b.type === 'income');

    const totalFixedExpense = fixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const totalFixedIncome = fixedIncomes.reduce((acc, curr) => acc + curr.amount, 0);
    const plannedAvailable = totalFixedIncome - totalFixedExpense;
    const realNetFlow = totalIncome - totalExpense;

    const budgetComparisonChart: BudgetVsActualItem[] = [
      {
        name: 'Gastos Fijos',
        Planeado: totalFixedExpense,
        Real: totalExpense,
      },
      {
        name: 'Ingresos',
        Planeado: totalFixedIncome,
        Real: totalIncome,
      },
      {
        name: 'Flujo Neto',
        Planeado: Math.max(0, plannedAvailable),
        Real: Math.max(0, realNetFlow),
      },
    ];

    return {
      totalExpense,
      totalIncome,
      expenseDataParents,
      expenseDataChildren,
      incomeDataParents,
      incomeDataChildren,
      totalFixedExpense,
      totalFixedIncome,
      plannedAvailable,
      realNetFlow,
      fixedExpenses,
      fixedIncomes,
      budgetComparisonChart,
    };
  }, [currentDate]);

  const isLoading = !reportData;

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const currentChartData = (() => {
    if (!reportData) return [];
    if (activeTab === 'expenses') {
      return hierarchyView === 'parents' ? reportData.expenseDataParents : reportData.expenseDataChildren;
    }
    if (activeTab === 'income') {
      return hierarchyView === 'parents' ? reportData.incomeDataParents : reportData.incomeDataChildren;
    }
    return [];
  })();

  const currentTotal = activeTab === 'expenses'
    ? reportData?.totalExpense ?? 0
    : reportData?.totalIncome ?? 0;

  // Fixed Budget calculations
  const expensePercentage = (reportData && reportData.totalFixedExpense > 0)
    ? Math.round((reportData.totalExpense / reportData.totalFixedExpense) * 100)
    : 0;

  const incomePercentage = (reportData && reportData.totalFixedIncome > 0)
    ? Math.round((reportData.totalIncome / reportData.totalFixedIncome) * 100)
    : 0;

  const expenseDifference = (reportData?.totalFixedExpense ?? 0) - (reportData?.totalExpense ?? 0);

  return (
    <div className="p-4 space-y-6">
      {/* Header & Month Selector */}
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Informes</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Analiza tus gastos, ingresos y cumplimiento de presupuesto
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <button
            onClick={() => navigateMonth('prev')}
            aria-label="Mes anterior"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </span>
          <button
            onClick={() => navigateMonth('next')}
            aria-label="Mes siguiente"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Main Tabs: Gastos / Ingresos / Presupuesto Fijo */}
      <nav className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-2xl gap-1 text-xs font-semibold" aria-label="Secciones de informe">
        <button
          onClick={() => setActiveTab('expenses')}
          className={cn(
            "flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5",
            activeTab === 'expenses'
              ? "bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <TrendingDown size={15} />
          <span>Gastos</span>
        </button>

        <button
          onClick={() => setActiveTab('income')}
          className={cn(
            "flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5",
            activeTab === 'income'
              ? "bg-white dark:bg-slate-900 text-green-600 dark:text-green-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <TrendingUp size={15} />
          <span>Ingresos</span>
        </button>

        <button
          onClick={() => setActiveTab('fixed-budget')}
          className={cn(
            "flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5",
            activeTab === 'fixed-budget'
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Target size={15} />
          <span>Presupuesto Fijo</span>
        </button>
      </nav>

      {/* Views: Expenses or Income Breakdown */}
      {(activeTab === 'expenses' || activeTab === 'income') && (
        <section className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
          {/* Header & Hierarchy Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {activeTab === 'expenses' ? (
                  <>
                    <TrendingDown className="text-red-500" size={18} />
                    Gastos por {hierarchyView === 'parents' ? 'Categoría' : 'Subcategoría'}
                  </>
                ) : (
                  <>
                    <TrendingUp className="text-green-500" size={18} />
                    Ingresos por {hierarchyView === 'parents' ? 'Categoría' : 'Subcategoría'}
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Total mes:{' '}
                <span className={cn(
                  "font-bold",
                  activeTab === 'expenses' ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                )}>
                  {isLoading ? '...' : formatCurrency(currentTotal)}
                </span>
              </p>
            </div>

            {/* Subcategory vs Parent Category Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto gap-1 text-[11px] font-medium">
              <button
                data-testid="toggle-parents"
                onClick={() => setHierarchyView('parents')}
                className={cn(
                  "py-1 px-2.5 rounded-lg transition-all flex items-center gap-1.5",
                  hierarchyView === 'parents'
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                )}
                title="Consolidar en categorías padre"
              >
                <Layers size={13} />
                <span>Categorías</span>
              </button>
              <button
                data-testid="toggle-children"
                onClick={() => setHierarchyView('children')}
                className={cn(
                  "py-1 px-2.5 rounded-lg transition-all flex items-center gap-1.5",
                  hierarchyView === 'children'
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                )}
                title="Ver detalle por subcategorías"
              >
                <ListTree size={13} />
                <span>Subcategorías</span>
              </button>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center animate-pulse gap-2">
                <div className="w-12 h-40 bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded"></div>
              </div>
            ) : (
              <ExpenseBarChart
                data={currentChartData}
                emptyMessage={
                  activeTab === 'expenses'
                    ? 'No hay gastos registrados en este mes.'
                    : 'No hay ingresos registrados en este mes.'
                }
              />
            )}
          </div>

          {/* Detailed Item List */}
          {!isLoading && currentChartData.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Desglose detallado
              </h3>
              <div className="space-y-2">
                {currentChartData.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex flex-col gap-1.5 border border-slate-100/80 dark:border-slate-800/60"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.name}
                        </span>
                        {item.parentName && (
                          <span className="text-[10px] text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded shrink-0">
                            {item.parentName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency(item.value)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium w-9 text-right">
                          {Math.round(item.percentage || 0)}%
                        </span>
                      </div>
                    </div>

                    {/* Percentage Bar */}
                    <div className="w-full bg-slate-200/70 dark:bg-slate-700/70 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, item.percentage || 0)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* View: Presupuesto Fijo vs Real */}
      {activeTab === 'fixed-budget' && (
        <section className="space-y-5">
          {/* Main Status & Compliance Alert */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="text-indigo-600 dark:text-indigo-400" size={20} />
                  Cumplimiento de Gastos Fijos
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Comparación entre tu presupuesto fijo planeado y los gastos reales del mes
                </p>
              </div>
              <Link
                to="/budget"
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline shrink-0"
              >
                Ajustar presupuesto &rarr;
              </Link>
            </div>

            {/* Gauge / Progress Card */}
            <div className={cn(
              "p-4 rounded-2xl border transition-all",
              (reportData?.totalFixedExpense ?? 0) === 0
                ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                : expensePercentage > 100
                  ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40"
                  : expensePercentage >= 85
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                    : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  {(reportData?.totalFixedExpense ?? 0) === 0 ? (
                    'Sin presupuesto de gastos fijos'
                  ) : expensePercentage > 100 ? (
                    <>
                      <AlertTriangle size={15} className="text-red-500" />
                      <span className="text-red-700 dark:text-red-400 font-bold">Límite excedido ({expensePercentage}%)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} className="text-emerald-500" />
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">Dentro del presupuesto ({expensePercentage}%)</span>
                    </>
                  )}
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {formatCurrency(reportData?.totalExpense ?? 0)} / {formatCurrency(reportData?.totalFixedExpense ?? 0)}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    expensePercentage > 100
                      ? "bg-red-500"
                      : expensePercentage >= 85
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(100, expensePercentage)}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2">
                {(reportData?.totalFixedExpense ?? 0) === 0 ? (
                  <>Ve a la sección de <Link to="/budget" className="underline font-semibold">Presupuesto Fijo</Link> para registrar tus gastos fijos (arriendo, servicios, etc.).</>
                ) : expenseDifference >= 0 ? (
                  <>Te quedan <strong>{formatCurrency(expenseDifference)}</strong> de margen frente a tus gastos fijos presupuestados.</>
                ) : (
                  <>Has sobrepasado tus gastos fijos planeados por <strong>{formatCurrency(Math.abs(expenseDifference))}</strong>.</>
                )}
              </p>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Gastos Fijos Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 font-medium block mb-1">Gastos Fijos Planeados</span>
                <span className="text-base font-bold text-slate-900 dark:text-white block">
                  {formatCurrency(reportData?.totalFixedExpense ?? 0)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {reportData?.fixedExpenses.length ?? 0} rubros configurados
                </span>
              </div>

              {/* Ingresos Planeados Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 font-medium block mb-1">Ingresos Fijos Planeados</span>
                <span className="text-base font-bold text-slate-900 dark:text-white block">
                  {formatCurrency(reportData?.totalFixedIncome ?? 0)}
                </span>
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                  {incomePercentage}% recibido este mes
                </span>
              </div>

              {/* Disponible Planeado vs Real */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-500 font-medium block mb-1">Disponible Planeado</span>
                <span className={cn(
                  "text-base font-bold block",
                  (reportData?.plannedAvailable ?? 0) >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-500"
                )}>
                  {formatCurrency(reportData?.plannedAvailable ?? 0)}
                </span>
                <span className="text-[10px] text-slate-400">
                  Flujo real: {formatCurrency(reportData?.realNetFlow ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Grouped Comparison Chart */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Wallet size={16} className="text-indigo-500" />
              Gráfico Comparativo: Presupuesto Fijo vs Ejecución Real
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Valores presupuestados en Presupuesto Fijo vs transacciones registradas este mes
            </p>

            <div className="pt-2">
              {isLoading ? (
                <div className="h-64 flex items-center justify-center animate-pulse">
                  <div className="w-full h-40 bg-slate-100 dark:bg-slate-800 rounded"></div>
                </div>
              ) : (
                <BudgetVsActualChart data={reportData.budgetComparisonChart} />
              )}
            </div>
          </div>

          {/* Fixed Items List */}
          {!isLoading && reportData.fixedExpenses.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Rubros de Gastos Fijos Configurados
                </h3>
                <span className="text-xs text-slate-400">
                  Total: {formatCurrency(reportData.totalFixedExpense)}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportData.fixedExpenses.map(item => (
                  <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {item.name}
                    </span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      -{formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
