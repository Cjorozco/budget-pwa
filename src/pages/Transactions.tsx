import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Pencil, Trash2, AlertTriangle, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { TransactionItem, TransactionsEmpty } from '@/components/transactions/TransactionItem';
import type { Account, Transaction } from '@/lib/types';
import { useUIStore } from '@/store/ui';
import { useTranslation, getDateFnsLocale } from '@/lib/i18n';

export type TransactionFilter = 'all' | 'income' | 'expense';

export default function TransactionsPage() {
    const { confirm, addToast } = useUIStore();
    const { t, language } = useTranslation();
    const dateLocale = getDateFnsLocale(language);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<TransactionFilter>('all');
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [showAllHistory, setShowAllHistory] = useState<boolean>(false);

    // Fetch transactions with related data filtered by selected month
    const transactions = useLiveQuery(async () => {
        let txs: Transaction[];
        if (showAllHistory) {
            txs = await db.transactions.orderBy('date').reverse().toArray();
        } else {
            const start = startOfMonth(currentDate).getTime();
            const end = endOfMonth(currentDate).getTime();
            txs = await db.transactions
                .where('date')
                .between(start, end, true, true)
                .toArray();
            txs.sort((a, b) => b.date - a.date);
        }

        const cats = await db.categories.toArray();
        const accts = await db.accounts.toArray();

        const catMap = new Map(cats.map(c => [c.id, c]));
        const acctMap = new Map(accts.map(a => [a.id, a]));

        return txs.map(tx => {
            const category = catMap.get(tx.categoryId);
            const parentCategory = category?.parentId ? catMap.get(category.parentId) : null;
            const categoryDisplay = parentCategory
                ? `${parentCategory.name} > ${category?.name}`
                : category?.name || t.transactions.uncategorized;

            return {
                ...tx,
                categoryName: categoryDisplay,
                categoryColor: category?.color || 'gray',
                accountName: acctMap.get(tx.accountId)?.name || t.transactions.deletedAccount,
            };
        });
    }, [currentDate, showAllHistory, language]);

    const handleDelete = async (transaction: Transaction) => {
        const ok = await confirm({
            title: t.transactions.deleteConfirmTitle,
            message: t.transactions.deleteConfirmMsg,
            confirmLabel: t.common.delete,
            variant: 'danger',
        });
        if (!ok) {
            return;
        }

        setDeletingId(transaction.id);
        try {
            await db.transaction('rw', db.transactions, db.accounts, async () => {
                // 1. Reverse the balance effect
                const account = await db.accounts.get(transaction.accountId);
                if (account) {
                    const isIncome = transaction.type === 'income' || (transaction.type === 'transfer' && transaction.categoryId === 'transfer-in');
                    const amount = transaction.amount;

                    const reversedCalcBalance = isIncome
                        ? account.calculatedBalance - amount
                        : account.calculatedBalance + amount;

                    const updateData: Partial<Account> = { calculatedBalance: reversedCalcBalance };

                    if (account.actualBalance !== undefined) {
                        updateData.actualBalance = isIncome
                            ? account.actualBalance - amount
                            : account.actualBalance + amount;
                    }

                    await db.accounts.update(transaction.accountId, updateData);
                }

                // 2. Handle Linked Transfer Deletion (Integrity)
                if (transaction.type === 'transfer' && transaction.transferId) {
                    const linkedTx = await db.transactions
                        .where('transferId').equals(transaction.transferId)
                        .and(t => t.id !== transaction.id)
                        .first();

                    if (linkedTx) {
                        // Reverse balance for the linked account too
                        const linkedAccount = await db.accounts.get(linkedTx.accountId);
                        if (linkedAccount) {
                            const isLinkedIncome = linkedTx.categoryId === 'transfer-in';
                            const linkedAmount = linkedTx.amount;

                            const linkedReversedBalance = isLinkedIncome
                                ? linkedAccount.calculatedBalance - linkedAmount
                                : linkedAccount.calculatedBalance + linkedAmount;

                            const linkedUpdate: Partial<Account> = { calculatedBalance: linkedReversedBalance };
                            if (linkedAccount.actualBalance !== undefined) {
                                linkedUpdate.actualBalance = isLinkedIncome
                                    ? linkedAccount.actualBalance - linkedAmount
                                    : linkedAccount.actualBalance + linkedAmount;
                            }

                            await db.accounts.update(linkedTx.accountId, linkedUpdate);
                        }
                        // Delete the linked transaction
                        await db.transactions.delete(linkedTx.id);
                    }
                }

                // 3. Delete the transaction
                await db.transactions.delete(transaction.id);
            });
            addToast(t.transactions.deleteSuccess, 'success');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            addToast(t.transactions.deleteError, 'error');
        } finally {
            setDeletingId(null);
        }
    };

    if (!transactions) return null;

    const filteredTransactions = transactions.filter((tx) => {
        if (filter === 'all') return true;
        if (filter === 'income') return tx.type === 'income' || (tx.type === 'transfer' && tx.categoryId === 'transfer-in');
        if (filter === 'expense') return tx.type === 'expense' || (tx.type === 'transfer' && tx.categoryId === 'transfer-out');
        return true;
    });

    const navigateMonth = (direction: 'prev' | 'next') => {
        setShowAllHistory(false);
        setCurrentDate((prev) => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
    };

    const goToCurrentMonth = () => {
        setShowAllHistory(false);
        setCurrentDate(new Date());
    };

    const monthLabel = showAllHistory
        ? t.transactions.allHistory
        : format(currentDate, "MMMM yyyy", { locale: dateLocale });

    return (
        <div className="p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.transactions.title}</h1>
                <Button
                    data-testid="new-transaction-button"
                    data-tour="new-transaction"
                    aria-label={t.transactions.newTransaction}
                    size="sm"
                    className="rounded-full h-10 w-10 p-0"
                    onClick={() => {
                        setEditingTransaction(null);
                        setIsModalOpen(true);
                    }}
                >
                    <Plus size={24} />
                </Button>
            </div>

            {/* Month Navigator */}
            <div data-tour="month-navigator" className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <button
                    type="button"
                    aria-label="Previous month"
                    data-testid="prev-month-button"
                    onClick={() => navigateMonth('prev')}
                    className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="flex items-center gap-2">
                    <span data-testid="current-month-display" className="font-semibold text-slate-800 dark:text-slate-100 capitalize text-sm sm:text-base">
                        {monthLabel}
                    </span>
                    {!showAllHistory && !isSameMonth(currentDate, new Date()) && (
                        <button
                            type="button"
                            data-testid="go-current-month-button"
                            onClick={goToCurrentMonth}
                            className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition-colors"
                        >
                            {t.transactions.currentMonth}
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    aria-label="Next month"
                    data-testid="next-month-button"
                    onClick={() => navigateMonth('next')}
                    className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Filter Selector */}
            <div
                data-tour="transaction-filters"
                className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1"
                role="tablist"
                aria-label="Filter"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'all'}
                    data-testid="filter-all"
                    onClick={() => setFilter('all')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                        filter === 'all'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    {t.transactions.allFilter}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'income'}
                    data-testid="filter-income"
                    onClick={() => setFilter('income')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                        filter === 'income'
                            ? 'bg-white dark:bg-slate-900 text-green-600 dark:text-green-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400'
                    }`}
                >
                    {t.transactions.incomesFilter}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'expense'}
                    data-testid="filter-expense"
                    onClick={() => setFilter('expense')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                        filter === 'expense'
                            ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400'
                    }`}
                >
                    {t.transactions.expensesFilter}
                </button>
            </div>

            {filteredTransactions.length === 0 ? (
                <TransactionsEmpty
                    message={
                        filter === 'income'
                            ? t.transactions.noIncomeMonth.replace('{month}', monthLabel)
                            : filter === 'expense'
                            ? t.transactions.noExpenseMonth.replace('{month}', monthLabel)
                            : t.transactions.noMovementsMonth.replace('{month}', monthLabel)
                    }
                />
            ) : (
                <ul className="space-y-3">
                    {filteredTransactions.map((tx, index) => {
                        const isIncome = tx.type === 'income' || (tx.type === 'transfer' && tx.categoryId === 'transfer-in');
                        return (
                            <TransactionItem
                                key={tx.id}
                                index={index}
                                title={tx.description}
                                subtitle={`${format(tx.date, "d MMM, yyyy", { locale: dateLocale })} • ${tx.accountName}`}
                                categoryLabel={tx.type === 'transfer' ? t.transactions.transferTag : tx.categoryName}
                                amount={tx.amount}
                                direction={isIncome ? 'in' : 'out'}
                                iconColor={tx.type === 'transfer' ? '#64748b' : tx.categoryColor}
                                icon={tx.type === 'transfer' ? <ArrowRightLeft size={16} /> : tx.categoryName[0]?.toUpperCase()}
                                badges={
                                    <>
                                        {(tx.isAmbiguous || tx.needsReview) && (
                                            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                                                <AlertTriangle size={8} /> {t.transactions.reviewTag}
                                            </span>
                                        )}
                                        {tx.isAdjustment && (
                                            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-0.5">
                                                {t.transactions.adjustmentTag}
                                            </span>
                                        )}
                                        {tx.type === 'transfer' && (
                                            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-0.5">
                                                {t.transactions.transferTag}
                                            </span>
                                        )}
                                    </>
                                }
                                actions={
                                    <>
                                        {/* Las transferencias son dos movimientos enlazados: editarlas como gasto/ingreso desajustaría los saldos. Solo se pueden borrar. */}
                                        {tx.type !== 'transfer' && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                                aria-label={t.transactions.editTransaction}
                                                onClick={() => {
                                                    setEditingTransaction(tx);
                                                    setIsModalOpen(true);
                                                }}
                                            >
                                                <Pencil size={14} />
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                            aria-label={t.common.delete}
                                            onClick={() => handleDelete(tx)}
                                            isLoading={deletingId === tx.id}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </>
                                }
                            />
                        );
                    })}
                </ul>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingTransaction(null);
                }}
                title={editingTransaction ? t.transactions.editTransaction : t.transactions.newTransaction}
            >
                <TransactionForm
                    initialData={editingTransaction}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        setEditingTransaction(null);
                    }}
                />
            </Modal>
        </div>
    );
}
