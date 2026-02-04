import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, Check, Pencil, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AmbiguousReviewPage() {
    const [editingTx, setEditingTx] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const ambiguousTransactions = useLiveQuery(() =>
        db.transactions
            .filter(tx => tx.isAmbiguous === true || (tx.aiConfidence !== undefined && tx.aiConfidence < 0.7))
            .toArray()
    ) || [];

    const categories = useLiveQuery(() => db.categories.toArray()) || [];

    const getCategoryName = (id: string) => {
        const cat = categories.find(c => c.id === id);
        return cat ? cat.name : 'Sin categoría';
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta transacción?')) return;

        await db.transaction('rw', db.transactions, db.accounts, async () => {
            const tx = await db.transactions.get(id);
            if (tx) {
                const account = await db.accounts.get(tx.accountId);
                if (account) {
                    const newBalance = tx.type === 'income'
                        ? account.calculatedBalance - tx.amount
                        : account.calculatedBalance + tx.amount;
                    await db.accounts.update(tx.accountId, { calculatedBalance: newBalance });
                }
                await db.transactions.delete(id);
            }
        });
    };

    const handleConfirm = async (tx: any) => {
        await db.transactions.update(tx.id, {
            isAmbiguous: false,
            needsReview: false,
            aiConfidence: 1.0,
            updatedAt: Date.now()
        });
    };

    if (ambiguousTransactions.length === 0) {
        return (
            <div className="p-8 text-center safe-bottom">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check size={40} />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">¡Todo en Orden!</h1>
                <p className="text-slate-500 max-w-xs mx-auto">
                    No hay transacciones ambiguas que necesiten revisión. La IA está aprendiendo bien de tus hábitos.
                </p>
                <Button className="mt-8" variant="outline" onClick={() => window.history.back()}>
                    Volver
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 safe-bottom space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" />
                    Revisión de Gastos
                </h1>
                <p className="text-sm text-slate-500">
                    Confirma o corrige las {ambiguousTransactions.length} transacciones que la IA marcó como dudosas.
                </p>
            </header>

            <div className="space-y-4">
                {ambiguousTransactions.map((tx) => (
                    <div
                        key={tx.id}
                        className="bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 shadow-sm"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                                    {tx.description}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-medium text-slate-400">
                                        {format(tx.date, "eeee d 'de' MMMM", { locale: es })}
                                    </span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">
                                        Confianza: {Math.round((tx.aiConfidence || 0) * 100)}%
                                    </span>
                                </div>
                            </div>
                            <div className={`text-lg font-black ${tx.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                                {tx.type === 'expense' ? '-' : '+'} {formatCurrency(tx.amount)}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                <Sparkles size={10} />
                                {getCategoryName(tx.categoryId)}
                            </div>
                            {tx.tagIds?.map((tagId: string) => (
                                <TagBadge key={tagId} tagId={tagId} />
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/40"
                                onClick={() => handleConfirm(tx)}
                            >
                                <Check size={16} className="mr-1" /> Confirmar
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/40"
                                onClick={() => {
                                    setEditingTx(tx);
                                    setIsModalOpen(true);
                                }}
                            >
                                <Pencil size={16} className="mr-1" /> Editar
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/20 dark:hover:bg-red-900/40"
                                onClick={() => handleDelete(tx.id)}
                            >
                                <Trash2 size={16} className="mr-1" /> Borrar
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingTx(null);
                }}
                title="Corregir Transacción"
            >
                <TransactionForm
                    initialData={editingTx}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        setEditingTx(null);
                    }}
                />
            </Modal>
        </div>
    );
}

function TagBadge({ tagId }: { tagId: string }) {
    const tag = useLiveQuery(() => db.tags.get(tagId), [tagId]);
    if (!tag) return null;
    return (
        <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white shadow-sm"
            style={{ backgroundColor: tag.color }}
        >
            {tag.name}
        </span>
    );
}
