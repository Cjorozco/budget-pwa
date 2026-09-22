import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { cn, formatCurrency } from '@/lib/utils';
import { Trash2, Pencil, TrendingUp, TrendingDown, Info, Calculator } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { BudgetItem } from '@/lib/types';
import { useUIStore } from '@/store/ui';

export default function Budget() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [newItemType, setNewItemType] = useState<'income' | 'expense'>('income');
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [expenseSortOrder, setExpenseSortOrder] = useState<'az' | 'za' | 'amount-asc' | 'amount-desc'>('amount-desc');
  const { addToast, confirm } = useUIStore();

  const budgetItems = useLiveQuery(() => db.budgetItems.toArray()) || [];

  const fixedIncomes = budgetItems.filter(item => item.type === 'income');
  const fixedExpenses = budgetItems.filter(item => item.type === 'expense');

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
      addToast("Por favor completa los campos correctamente", "error");
      return;
    }

    try {
      if (editingItem) {
        await db.budgetItems.update(editingItem.id, {
          name: newItemName.trim(),
          amount: Number(newItemAmount),
          type: newItemType,
        });
        addToast("Rubro actualizado exitosamente", "success");
      } else {
        const newItem: BudgetItem = {
          id: crypto.randomUUID(),
          name: newItemName.trim(),
          amount: Number(newItemAmount),
          type: newItemType,
          createdAt: Date.now()
        };
        await db.budgetItems.add(newItem);
        addToast("Añadido exitosamente", "success");
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving budget item:", error);
      addToast("Error al guardar", "error");
    }
  };

  const handleDeleteItem = async (id: string) => {
    const ok = await confirm({
      title: '¿Eliminar rubro?',
      message: '¿Seguro que deseas eliminar este rubro del presupuesto?',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await db.budgetItems.delete(id);
      addToast("Eliminado exitosamente", "success");
    } catch (error) {
      console.error("Error deleting budget item:", error);
      addToast("Error al eliminar", "error");
    }
  };

  return (
    <div className="p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Presupuesto Fijo</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Planifica tu mes antes de gastar
        </p>
      </header>

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
            Disponible Planeado
          </span>
        </div>
        <div className="text-4xl font-bold tracking-tight">
          {formatCurrency(Math.max(0, plannedAvailable))}
        </div>
        {plannedAvailable < 0 && (
          <div className="mt-2 text-xs font-medium text-red-200 bg-red-800/50 p-2 rounded-lg inline-block">
            ¡Tus gastos fijos superan tus ingresos! ({formatCurrency(plannedAvailable)})
          </div>
        )}
        {plannedAvailable >= 0 && (
          <div className="mt-2 text-xs font-medium text-indigo-100/80">
            Dinero libre para gastos variables o ahorros.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="text-green-500" size={18} />
            <span className="text-xs text-slate-500 font-medium">Ingresos Fijos</span>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalFixedIncome)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="text-red-500" size={18} />
            <span className="text-xs text-slate-500 font-medium">Gastos Fijos</span>
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
            Ingresos Mensuales
          </h2>
          <button
            onClick={() => handleOpenAddModal('income')}
            className="text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
          >
            + Añadir
          </button>
        </div>

        <div className="space-y-2">
          {fixedIncomes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              No has registrado ingresos fijos (ej. Salario)
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
                    aria-label={`Editar ${item.name}`}
                    className="text-slate-400 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    aria-label={`Eliminar ${item.name}`}
                    className="text-slate-400 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Eliminar"
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
            Gastos Fijos
          </h2>
          <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <select
              value={expenseSortOrder}
              onChange={(e) => setExpenseSortOrder(e.target.value as 'az' | 'za' | 'amount-asc' | 'amount-desc')}
              className="text-sm bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 focus:ring-0 cursor-pointer outline-none shrink-0"
            >
              <option value="amount-desc">Mayor a menor</option>
              <option value="amount-asc">Menor a mayor</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
            </select>
            <button
              onClick={() => handleOpenAddModal('expense')}
              className="text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors shrink-0 whitespace-nowrap"
            >
              + Añadir
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {sortedFixedExpenses.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              No has registrado gastos fijos (ej. Arriendo, Servicios)
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
                    aria-label={`Editar ${item.name}`}
                    className="text-slate-400 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    aria-label={`Eliminar ${item.name}`}
                    className="text-slate-400 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Eliminar"
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
          Estos rubros no afectan directamente el saldo de tus cuentas reales. Son una herramienta de planeación para saber cuánto de tus ingresos mensuales ya está comprometido.
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
            ? (editingItem.type === 'income' ? 'Editar Ingreso Fijo' : 'Editar Gasto Fijo')
            : (newItemType === 'income' ? 'Nuevo Ingreso Fijo' : 'Nuevo Gasto Fijo')
        }
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nombre del rubro
            </label>
            <input
              type="text"
              required
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder={newItemType === 'income' ? 'Ej. Salario, Rendimientos' : 'Ej. Arriendo, Internet, Plan celular'}
              className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-0 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Monto mensual esperado
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
            {editingItem ? 'Actualizar' : 'Guardar'} {newItemType === 'income' ? 'Ingreso' : 'Gasto'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddModalOpen(false);
              setEditingItem(null);
            }}
            className="w-full h-12 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
        </form>
      </Modal>
    </div>
  );
}
