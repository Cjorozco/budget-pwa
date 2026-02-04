import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/lib/types';

export default function TransactionsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Fetch transactions with related data
    const transactions = useLiveQuery(async () => {
        const txs = await db.transactions.orderBy('date').reverse().toArray();
        const cats = await db.categories.toArray();
        const accts = await db.accounts.toArray();
        const allTags = await db.tags.toArray();

        // Map for fast lookup
        const catMap = new Map(cats.map(c => [c.id, c]));
        const acctMap = new Map(accts.map(a => [a.id, a]));
        const tagMap = new Map(allTags.map(t => [t.id, t]));

        return txs.map(tx => {
            const category = catMap.get(tx.categoryId);
            const parentCategory = category?.parentId ? catMap.get(category.parentId) : null;
            const categoryDisplay = parentCategory
                ? `${parentCategory.name} > ${category?.name}`
                : category?.name || 'Sin Categoría';

            return {
                ...tx,
                categoryName: categoryDisplay,
                categoryColor: category?.color || 'gray',
                accountName: acctMap.get(tx.accountId)?.name || 'Cuenta Eliminada',
                tags: (tx.tagIds || []).map(id => tagMap.get(id)).filter(Boolean) as any[]
            };
        });
    });

    const handleDelete = async (transaction: any) => {
        if (!confirm('¿Eliminar esta transacción? Esta acción no se puede deshacer.')) {
            return;
        }

        setDeletingId(transaction.id);
        try {
            await db.transaction('rw', db.transactions, db.accounts, async () => {
                // 1. Reverse the balance effect
                const account = await db.accounts.get(transaction.accountId);
                if (account) {
                    const reversedBalance =
                        transaction.type === 'income'
                            ? account.calculatedBalance - transaction.amount
                            : account.calculatedBalance + transaction.amount;

                    await db.accounts.update(transaction.accountId, {
                        calculatedBalance: reversedBalance,
                    });
                }

                // 2. Delete the transaction
                await db.transactions.delete(transaction.id);
            });
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Error al eliminar la transacción');
        } finally {
            setDeletingId(null);
        }
    };

    if (!transactions) return null;

    return (
        <div className="p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Movimientos</h1>
                <Button onClick={() => {
                    setEditingTransaction(null);
                    setIsModalOpen(true);
                }} size="sm" className="rounded-full h-10 w-10 p-0">
                    <Plus size={24} />
                </Button>
            </div>

            <div className="space-y-3">
                {transactions.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        No hay movimientos aún.
                        <br />
                        ¡Agrega tu primera transacción!
                    </div>
                ) : (
                    transactions.map((tx) => (
                        <div
                            key={tx.id}
                            className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800"
                        >
                            <div className="flex items-center gap-3 flex-1">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0`}
                                    style={{ backgroundColor: tx.categoryColor }}
                                >
                                    {tx.categoryName[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                                        {tx.description}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {format(tx.date, "d MMM, yyyy", { locale: es })} • {tx.accountName}
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {tx.tags?.map((tag: any) => (
                                            <span
                                                key={tag.id}
                                                className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
                                                style={{ backgroundColor: tag.color }}
                                            >
                                                {tag.name}
                                            </span>
                                        ))}
                                        {(tx.isAmbiguous || tx.needsReview) && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                                                <AlertTriangle size={8} /> Revisar
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-right">
                                    <p
                                        className={`font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                                            }`}
                                    >
                                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {tx.categoryName}
                                    </p>
                                </div>
                                <div className="flex gap-1 ml-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={() => {
                                            setEditingTransaction(tx);
                                            setIsModalOpen(true);
                                        }}
                                    >
                                        <Pencil size={14} />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        onClick={() => handleDelete(tx)}
                                        isLoading={deletingId === tx.id}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingTransaction(null);
                }}
                title={editingTransaction ? "Editar Transacción" : "Nueva Transacción"}
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
