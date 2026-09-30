import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  Info,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import type { BudgetItem } from '@/lib/types';
import { useUIStore } from '@/store/ui';
import { useTranslation, getDateFnsLocale } from '@/lib/i18n';

export default function Budget() {
  const { t, language } = useTranslation();
  const dateLocale = getDateFnsLocale(language);
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');

  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split('-').map(Number);
      return new Date(year, month - 1, 1);
    }
    return new Date();
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [newItemType, setNewItemType] = useState<'income' | 'expense'>('income');
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [expenseSortOrder, setExpenseSortOrder] = useState<'az' | 'za' | 'amount-asc' | 'amount-desc'>('amount-desc');
  const { addToast, confirm } = useUIStore();

  const currentMonthKey = format(currentDate, 'yyyy-MM');
  const isViewingCurrentRealMonth = currentMonthKey === format(new Date(), 'yyyy-MM');

  const allBudgetItems = useLiveQuery(() => db.budgetItems.toArray()) || [];

  // Filter items specifically for the active month
  const currentMonthItems = useMemo(() => {
    return allBudgetItems.filter(item => {
      const itemMonth = item.month || format(new Date(item.createdAt || Date.now()), 'yyyy-MM');
      return itemMonth === currentMonthKey;
    });
  }, [allBudgetItems, currentMonthKey]);

  const fixedIncomes = currentMonthItems.filter(item => item.type === 'income');
  const fixedExpenses = currentMonthItems.filter(item => item.type === 'expense');

  // Check if previous month has items to offer one-click cloning
  const prevDate = subMonths(currentDate, 1);
  const prevMonthKey = format(prevDate, 'yyyy-MM');
  const prevMonthItems = useMemo(() => {
    return allBudgetItems.filter(item => {
      const itemMonth = item.month || format(new Date(item.createdAt || Date.now()), 'yyyy-MM');
      return itemMonth === prevMonthKey;
    });
  }, [allBudgetItems, prevMonthKey]);

  const sortedFixedExpenses = [...fixedExpenses].sort((a, b) => {
    switch (expenseSortOrder) {
      case 'az':
        return a.name.localeCompare(b.name);
      case 'za':
        return b.name.localeCompare(a.name);
      case 'amount-asc':
        return a.amount - b.amount;
      case 'amount-desc':
        return b.amount - a.amount;
      default:
        return 0;
    }
  });

  const totalFixedIncome = fixedIncomes.reduce((acc, curr) => acc + curr.amount, 0);
  const totalFixedExpense = fixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const plannedAvailable = totalFixedIncome - totalFixedExpense;

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const next = direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
      setSearchParams({ month: format(next, 'yyyy-MM') }, { replace: true });
      return next;
    });
  };

  const jumpToCurrentMonth = () => {
    const now = new Date();
    setCurrentDate(now);
    setSearchParams({ month: format(now, 'yyyy-MM') }, { replace: true });
  };

  const handleCopyPreviousMonth = async () => {
    if (prevMonthItems.length === 0) return;
    try {
      const clonedItems: BudgetItem[] = prevMonthItems.map(item => ({
        id: crypto.randomUUID(),
        month: currentMonthKey,
        name: item.name,
        amount: item.amount,
        type: item.type,
        categoryId: item.categoryId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      await db.budgetItems.bulkAdd(clonedItems);
      addToast(
        t.budget.copySuccess.replace('{month}', format(prevDate, 'MMMM yyyy', { locale: dateLocale })),
        'success'
      );
    } catch (err) {
      console.error('Error copying budget:', err);
      addToast(t.common.error, 'error');
    }
  };

  const handleOpenAddModal = (type: 'income' | 'expense') => {
    setEditingItem(null);
    setNewItemType(type);
    setNewItemName('');
    setNewItemAmount('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: BudgetItem) => {
    setEditingItem(item);
    setNewItemType(item.type);
    setNewItemName(item.name);
    setNewItemAmount(item.amount.toString());
    setIsAddModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newItemName.trim() || !newItemAmount || Number(newItemAmount) <= 0) {
      addToast(t.common.error, "error");
      return;
    }

    try {
      if (editingItem) {
        await db.budgetItems.update(editingItem.id, {
          name: newItemName.trim(),
          amount: Number(newItemAmount),
          type: newItemType,
          updatedAt: Date.now(),
        });
        addToast(t.budget.budgetSaved, "success");
      } else {
        const newItem: BudgetItem = {
          id: crypto.randomUUID(),
          month: currentMonthKey,
          name: newItemName.trim(),
          amount: Number(newItemAmount),
          type: newItemType,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.budgetItems.add(newItem);
        addToast(t.budget.budgetSaved, "success");
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving budget item:", error);
      addToast(t.common.error, "error");
    }
  };

  const handleDeleteItem = async (id: string) => {
    const ok = await confirm({
      title: t.budget.deleteItemTitle,
      message: t.budget.deleteItemMsg,
      confirmLabel: t.common.delete,
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await db.budgetItems.delete(id);
      addToast(t.common.success, "success");
    } catch (error) {
      console.error("Error deleting budget item:", error);
      addToast(t.common.error, "error");
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header & Month Selector */}
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.budget.fixedBudgetTitle}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.budget.fixedBudgetSubtitle}
          </p>
        </div>

        {/* Month Selector Carousel */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <button
            onClick={() => navigateMonth('prev')}
            aria-label="Previous month"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
              {format(currentDate, "MMMM yyyy", { locale: dateLocale })}
            </span>
            {!isViewingCurrentRealMonth && (
              <button
                type="button"
                onClick={jumpToCurrentMonth}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
              >
                {t.transactions.currentMonth}
              </button>
            )}
          </div>
          <button
            onClick={() => navigateMonth('next')}
            aria-label="Next month"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Copy Previous Month Banner if Current Month is Empty */}
      {currentMonthItems.length === 0 && prevMonthItems.length > 0 && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
              {t.budget.noItemsInMonthBanner.replace('{month}', format(currentDate, 'MMMM yyyy', { locale: dateLocale }))}
            </h3>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
              {t.budget.copyFromPreviousMonth.replace('{month}', format(prevDate, 'MMMM yyyy', { locale: dateLocale }))}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyPreviousMonth}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Copy size={14} />
            {t.budget.copyMonthBtn
              .replace('{count}', String(prevMonthItems.length))
              .replace('{month}', format(prevDate, 'MMMM', { locale: dateLocale }))}
          </button>
        </div>
      )}

      {/* Resumen Card */}
      <div className={cn(
        "p-6 rounded-3xl shadow-lg border-2",
        plannedAvailable < 0
          ? "bg-gradient-to-br from-red-600 to-red-700 border-red-500 text-white"
          : "bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-500 text-white"
      )}>
        <div className="flex items-center gap-2 mb-2 text-indigo-100">
          <Calculator size={20} className={plannedAvailable < 0 ? "text-red-200" : ""} />
          <span className={cn("text-sm font-medium", plannedAvailable < 0 ? "text-red-100" : "")}>
            {t.budget.plannedAvailable} ({format(currentDate, "MMMM", { locale: dateLocale })})
          </span>
        </div>
        <div className="text-4xl font-bold tracking-tight">
          {formatCurrency(Math.max(0, plannedAvailable))}
        </div>
        {plannedAvailable < 0 && (
          <div className="mt-2 text-xs font-medium text-red-200 bg-red-800/50 p-2 rounded-lg inline-block">
            {t.budget.overBudgetWarning.replace('{amount}', formatCurrency(plannedAvailable))}
          </div>
        )}
        {plannedAvailable >= 0 && (
          <div className="mt-2 text-xs font-medium text-indigo-100/80">
            {t.budget.freeMoney}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="text-green-500" size={18} />
            <span className="text-xs text-slate-500 font-medium">{t.budget.fixedIncomes}</span>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalFixedIncome)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="text-red-500" size={18} />
            <span className="text-xs text-slate-500 font-medium">{t.budget.fixedExpenses}</span>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalFixedExpense)}
          </p>
        </div>
      </div>

      {/* List of Income */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-green-600">
              <TrendingUp size={16} />
            </div>
            {t.budget.monthlyIncomes}
          </h2>
          <button
            onClick={() => handleOpenAddModal('income')}
            className="text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
          >
            {t.budget.addItem}
          </button>
        </div>

        <div className="space-y-2">
          {fixedIncomes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              {t.budget.noFixedIncomes}
            </p>
          ) : (
            fixedIncomes.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                  {item.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-600 text-sm mr-1">+{formatCurrency(item.amount)}</span>
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    aria-label={`${t.common.edit} ${item.name}`}
                    className="text-slate-400 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title={t.common.edit}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    aria-label={`${t.common.delete} ${item.name}`}
                    className="text-slate-400 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title={t.common.delete}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* List of Expenses */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white shrink-0">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600">
              <TrendingDown size={16} />
            </div>
            {t.budget.fixedExpenses}
          </h2>
          <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <select
              value={expenseSortOrder}
              onChange={(e) => setExpenseSortOrder(e.target.value as 'az' | 'za' | 'amount-asc' | 'amount-desc')}
              className="text-sm bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 focus:ring-0 cursor-pointer outline-none shrink-0"
            >
              <option value="amount-desc">{t.budget.sortAmountDesc}</option>
              <option value="amount-asc">{t.budget.sortAmountAsc}</option>
              <option value="az">{t.budget.sortAZ}</option>
              <option value="za">{t.budget.sortZA}</option>
            </select>
            <button
              onClick={() => handleOpenAddModal('expense')}
              className="text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors shrink-0 whitespace-nowrap"
            >
              {t.budget.addItem}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {sortedFixedExpenses.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              {t.budget.noFixedExpenses}
            </p>
          ) : (
            sortedFixedExpenses.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                  {item.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-600 text-sm mr-1">-{formatCurrency(item.amount)}</span>
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    aria-label={`${t.common.edit} ${item.name}`}
                    className="text-slate-400 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title={t.common.edit}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    aria-label={`${t.common.delete} ${item.name}`}
                    className="text-slate-400 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title={t.common.delete}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
        <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          {t.budget.fixedBudgetNote}
        </p>
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        title={
          editingItem
            ? (editingItem.type === 'income' ? t.budget.editFixedIncome : t.budget.editFixedExpense)
            : (newItemType === 'income' ? t.budget.newFixedIncome : t.budget.newFixedExpense)
        }
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.budget.itemNameLabel}
            </label>
            <input
              type="text"
              required
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder={newItemType === 'income' ? t.budget.incomePlaceholder : t.budget.expensePlaceholder}
              className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-0 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.budget.itemAmountLabel}
            </label>
            <input
              type="number"
              required
              min="1"
              step="any"
              value={newItemAmount}
              onChange={e => setNewItemAmount(e.target.value)}
              placeholder="0"
              className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-0 transition-colors"
            />
          </div>

          <button
            type="submit"
            className={cn(
              "w-full h-12 rounded-xl text-white font-bold transition-transform active:scale-95",
              newItemType === 'income' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
            )}
          >
            {editingItem ? t.budget.updateBtn : t.budget.saveBtn} {newItemType === 'income' ? t.budget.incomeWord : t.budget.expenseWord}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddModalOpen(false);
              setEditingItem(null);
            }}
            className="w-full h-12 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {t.common.cancel}
          </button>
        </form>
      </Modal>
    </div>
  );
}
