import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { cn, formatCurrency, now } from '@/lib/utils';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ArrowDownCircle, ArrowUpCircle, Wallet, AlertTriangle, ArrowRightLeft, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import type { QuickTemplate, Transaction } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { TransferForm } from '@/components/forms/TransferForm';
import { useTranslation, getDateFnsLocale } from '@/lib/i18n';
import { DemoEmptyState } from '@/components/DemoEmptyState';

export default function Dashboard() {
    const { t, language } = useTranslation();
    const dateLocale = getDateFnsLocale(language);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [templateData, setTemplateData] = useState<Partial<Transaction> | null>(null);
    const [showBalanceExplanation, setShowBalanceExplanation] = useState(false);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    // 1. Critical Data: Balance & Reserves (Atomic Transaction-like fetch)
    // We fetch this together to ensure 'Disponible' is never calculated from partial data
    const balanceData = useLiveQuery(async () => {
        const [accounts, reserves] = await Promise.all([
            db.accounts.filter(a => a.isActive).toArray(),
            db.reserves.filter(r => r.isActive).toArray()
        ]);

        const totalRealBalance = accounts.reduce((acc, curr) => acc + (curr.actualBalance ?? curr.calculatedBalance), 0);
        const totalReserved = reserves.reduce((acc, curr) => acc + curr.amount, 0);

        return {
            totalRealBalance,
            totalReserved,
            totalAvailable: totalRealBalance - totalReserved,
            accounts
        };
    });

    // 2. Secondary Data: Counts & Templates
    const secondaryData = useLiveQuery(async () => {
        const [ambiguousCount, quickTemplates] = await Promise.all([
            db.transactions
                .filter(tx => tx.isAmbiguous === true || (tx.aiConfidence !== undefined && tx.aiConfidence < 0.7))
                .count(),
            db.quickTemplates.toArray()
        ]);
        return { ambiguousCount, quickTemplates };
    });

    // 3. Heavy Data: Stats (Current Month) - EXCLUDING TRANSFERS
    const stats = useLiveQuery(async () => {
        const now = new Date();
        const start = startOfMonth(now).getTime();
        const end = endOfMonth(now).getTime();

        if (isNaN(start) || isNaN(end)) return { income: 0, expense: 0 };

        const txs = await db.transactions
            .where('date')
            .between(start, end)
            .toArray();

        // Filter out transfers explicitly
        const validTxs = txs.filter(t => t.type !== 'transfer');

        const income = validTxs
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + t.amount, 0);

        const expense = validTxs
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);

        return { income, expense };
    });

    // 4. Heavy Data: Recent Transactions - EXCLUDING TRANSFERS (Optional: or include them visually distinct)
    // For now, we include them but could filter or style them differently later.
    const recentTransactions = useLiveQuery(async () => {
        const txs = await db.transactions.orderBy('date').reverse().limit(5).toArray();
        const cats = await db.categories.toArray();
        const catMap = new Map(cats.map(c => [c.id, c]));

        return txs.map(tx => ({
            ...tx,
            categoryName: tx.type === 'transfer' ? 'Transferencia' : (catMap.get(tx.categoryId)?.name || 'Sin Categoría'),
            categoryColor: tx.type === 'transfer' ? '#64748b' : (catMap.get(tx.categoryId)?.color || 'gray')
        }));
    });

    const handleQuickTemplate = (data: QuickTemplate) => {
        // Safe access to accounts
        const defaultAccountId = balanceData?.accounts[0]?.id || '';
        setTemplateData({
            ...data,
            date: now(),
            accountId: defaultAccountId
        });
        setIsModalOpen(true);
    };

    // Derived values with safe defaults ONLY for rendering.
    // These are memoized to avoid recreating default objects/arrays on unrelated renders.
    const balanceMetrics = useMemo(() => {
        if (!balanceData) return { totalRealBalance: 0, totalReserved: 0, totalAvailable: 0 };
        return {
            totalRealBalance: balanceData.totalRealBalance,
            totalReserved: balanceData.totalReserved,
            totalAvailable: balanceData.totalAvailable
        };
    }, [balanceData]);

    const secondaryMetrics = useMemo(() => {
        if (!secondaryData) return { ambiguousCount: 0, quickTemplates: [] as QuickTemplate[] };
        return {
            ambiguousCount: secondaryData.ambiguousCount,
            quickTemplates: secondaryData.quickTemplates
        };
    }, [secondaryData]);

    const { totalRealBalance, totalReserved, totalAvailable } = balanceMetrics;
    const { ambiguousCount, quickTemplates } = secondaryMetrics;

    // Loading State specifically for Balance.
    // If balanceData is undefined, it means we are still loading from IndexedDB.
    const isLoading = !balanceData;

    return (
        <div className="p-4 space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.nav.dashboard}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                        {format(new Date(), "MMMM yyyy", { locale: dateLocale })}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsTransferModalOpen(true)}
                        className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-200 transition-colors"
                        aria-label={t.transactions.newTransfer}
                    >
                        <ArrowRightLeft size={20} />
                    </button>
                    <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <Wallet className="text-slate-600 dark:text-slate-300" size={20} />
                    </div>
                </div>
            </header>

            <DemoEmptyState />

            {/* AI Review Notice */}
            {ambiguousCount > 0 && (
                <Link
                    to="/review"
                    className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl animate-pulse"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-200 dark:bg-amber-800 rounded-lg text-amber-700 dark:text-amber-300">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                                {ambiguousCount} {t.transactions.ambiguousFilter}
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                {t.transactions.ambiguousHelp}
                            </p>
                        </div>
                    </div>
                    <span className="text-amber-600 font-bold">→</span>
                </Link>
            )}

            {/* Total Balance Card */}
            <div className={cn(
                "p-6 rounded-3xl shadow-lg transition-colors border-2 relative",
                isLoading ? "opacity-50 grayscale transition-all duration-500" : "",
                totalAvailable < 0
                    ? "bg-gradient-to-br from-red-600 to-red-700 text-white shadow-red-200 border-red-500 animate-pulse"
                    : "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-indigo-200 border-indigo-500"
            )}>
                <div className="flex items-center justify-between mb-1">
                    <p className={cn(
                        "text-sm font-medium",
                        totalAvailable < 0 ? "text-red-100" : "text-indigo-100"
                    )}>{t.dashboard.availableBalance}</p>
                    <button
                        type="button"
                        onClick={() => setShowBalanceExplanation(!showBalanceExplanation)}
                        className={cn(
                            "p-1 rounded-full transition-colors",
                            totalAvailable < 0
                                ? "hover:bg-red-500/40 text-red-200"
                                : "hover:bg-indigo-500/40 text-indigo-200"
                        )}
                        aria-label="Info"
                        title={t.dashboard.reservesTooltip}
                    >
                        <Info size={16} />
                    </button>
                </div>

                <div className="text-4xl font-bold tracking-tight">
                    {isLoading ? "..." : formatCurrency(totalAvailable)}
                </div>

                {showBalanceExplanation && (
                    <div className="mt-3 p-3 bg-black/20 backdrop-blur-sm rounded-2xl text-xs space-y-1 border border-white/10 animate-in fade-in zoom-in-95 duration-200">
                        <p className="font-semibold text-white/90">{t.dashboard.totalBalance}</p>
                        <p className="text-white/80 leading-relaxed">
                            {formatCurrency(totalRealBalance)} - {t.dashboard.savingsReserves} ({formatCurrency(totalReserved)}).
                        </p>
                    </div>
                )}

                {!showBalanceExplanation && totalReserved > 0 && (
                    <div className={cn(
                        "mt-2 text-[10px] font-medium",
                        totalAvailable < 0 ? "text-red-200" : "text-indigo-100/80"
                    )}>
                        {formatCurrency(totalRealBalance)} ({formatCurrency(totalReserved)} {t.dashboard.savingsReserves}).
                    </div>
                )}
            </div>

            {/* Monthly Stats */}
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowUpCircle className="text-green-500" size={20} />
                            <span className="text-sm text-slate-500 font-medium">{t.dashboard.monthlyIncome}</span>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {stats ? formatCurrency(stats.income) : '-'}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowDownCircle className="text-red-500" size={20} />
                            <span className="text-sm text-slate-500 font-medium">{t.dashboard.monthlyExpense}</span>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {stats ? formatCurrency(stats.expense) : '-'}
                        </p>
                    </div>
                </div>

                {stats && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">{t.dashboard.netSavings}:</span>
                        <span className={cn(
                            "font-bold",
                            stats.income - stats.expense >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                        )}>
                            {stats.income - stats.expense >= 0 ? "+" : ""}{formatCurrency(stats.income - stats.expense)}
                        </span>
                    </div>
                )}
            </div>

            {/* Quick Templates */}
            {quickTemplates.length > 0 && (
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.settings.manageTemplates}</h2>
                        <Link to="/settings" className="text-xs text-blue-600 font-medium">{t.common.edit}</Link>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {quickTemplates.map(template => (
                            <button
                                key={template.id}
                                onClick={() => handleQuickTemplate(template)}
                                className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:border-blue-200 transition-all active:scale-95 shrink-0 min-w-[100px]"
                            >
                                <span className="text-2xl">{template.icon}</span>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{template.name}</span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Recent Transactions */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.dashboard.recentTransactions}</h2>
                    <Link to="/transactions" className="text-sm text-blue-600 font-medium">{t.dashboard.viewAllTransactions}</Link>
                </div>
                <div className="space-y-3">
                    {recentTransactions?.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-50 dark:border-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm`}
                                    style={{ backgroundColor: tx.categoryColor }}
                                >
                                    {tx.type === 'transfer' ? <ArrowRightLeft size={16} /> : tx.categoryName[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-1">
                                        {tx.description}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                        {format(tx.date, "d MMM", { locale: dateLocale })}
                                    </p>
                                </div>
                            </div>
                            <div className={`font-semibold text-sm ${tx.type === 'income' ? 'text-green-600' :
                                tx.type === 'expense' ? 'text-red-600' : 'text-slate-600'
                                }`}>
                                {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}
                            </div>
                        </div>
                    ))}
                    {(!recentTransactions || recentTransactions.length === 0) && (
                        <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                            {t.dashboard.noRecentTransactions}
                        </div>
                    )}
                </div>
            </section>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setTemplateData(null);
                }}
                title={t.transactions.newTransaction}
            >
                <TransactionForm
                    initialData={templateData as Transaction | null}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        setTemplateData(null);
                    }}
                />
            </Modal>

            <Modal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                title={t.transactions.newTransfer}
            >
                <TransferForm
                    onSuccess={() => setIsTransferModalOpen(false)}
                    onCancel={() => setIsTransferModalOpen(false)}
                />
            </Modal>
        </div>
    );
}
