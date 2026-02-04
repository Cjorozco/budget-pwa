import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import type { Account } from '@/lib/types';
import { AlertTriangle, CheckCircle } from 'lucide-react';

const ReconciliationSchema = z.object({
    declaredBalance: z.number(),
    createAdjustment: z.boolean(),
});

type ReconciliationFormData = z.infer<typeof ReconciliationSchema>;

interface ReconciliationFormProps {
    account: Account;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ReconciliationForm({ account, onSuccess, onCancel }: ReconciliationFormProps) {
    const [adjustmentCategoryId, setAdjustmentCategoryId] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<ReconciliationFormData>({
        resolver: zodResolver(ReconciliationSchema),
        defaultValues: {
            declaredBalance: account.actualBalance || account.calculatedBalance,
            createAdjustment: true,
        },
    });

    const declaredBalance = watch('declaredBalance') || 0;
    const difference = declaredBalance - account.calculatedBalance;
    const hasDifference = Math.abs(difference) > 0.01; // Tolerance for floating point

    const onSubmit = async (data: ReconciliationFormData) => {
        try {
            await db.transaction('rw', db.reconciliations, db.accounts, db.transactions, db.categories, async () => {
                // 1. Find or create "Ajuste de Reconciliación" category
                let adjustmentCategory = await db.categories
                    .filter(c => c.name === 'Ajuste de Reconciliación' && c.type === 'expense')
                    .first();

                if (!adjustmentCategory) {
                    const catId = uuidv4();
                    await db.categories.add({
                        id: catId,
                        name: 'Ajuste de Reconciliación',
                        type: 'expense',
                        color: '#64748b',
                        usageCount: 0,
                        isActive: true,
                    });
                    adjustmentCategory = await db.categories.get(catId);
                }

                let adjustmentTransactionId: string | undefined = undefined;

                // 2. Create adjustment transaction if requested and there's a difference
                if (data.createAdjustment && hasDifference && adjustmentCategory) {
                    const txId = uuidv4();
                    const txType = difference > 0 ? 'income' : 'expense';
                    const txAmount = Math.abs(difference);

                    await db.transactions.add({
                        id: txId,
                        amount: txAmount,
                        description: `Ajuste de reconciliación - ${account.name}`,
                        type: txType,
                        accountId: account.id,
                        categoryId: adjustmentCategory.id,
                        date: Date.now(),
                        tagIds: [],
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });

                    adjustmentTransactionId = txId;

                    // Update account balance
                    await db.accounts.update(account.id, {
                        calculatedBalance: data.declaredBalance,
                    });
                }

                // 3. Save reconciliation record
                await db.reconciliations.add({
                    id: uuidv4(),
                    accountId: account.id,
                    date: Date.now(),
                    calculatedBalance: account.calculatedBalance,
                    declaredBalance: data.declaredBalance,
                    difference: difference,
                    adjustmentTransactionId,
                });

                // 4. Update account metadata
                await db.accounts.update(account.id, {
                    actualBalance: data.declaredBalance,
                    lastReconciliationDate: Date.now(),
                });
            });

            onSuccess();
        } catch (error) {
            console.error('Error during reconciliation:', error);
            alert('Error al reconciliar la cuenta');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Saldo Calculado:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(account.calculatedBalance)}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Saldo Real (Banco):</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(declaredBalance)}
                    </span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Diferencia:</span>
                    <span
                        className={`font-bold text-lg ${Math.abs(difference) < 0.01
                                ? 'text-green-600'
                                : difference > 0
                                    ? 'text-blue-600'
                                    : 'text-red-600'
                            }`}
                    >
                        {difference > 0 ? '+' : ''}
                        {formatCurrency(difference)}
                    </span>
                </div>
            </div>

            {hasDifference ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg">
                    <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                    <p className="text-sm">
                        Hay una diferencia de <b>{formatCurrency(Math.abs(difference))}</b>. Se creará una transacción de ajuste para corregir el saldo.
                    </p>
                </div>
            ) : (
                <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg">
                    <CheckCircle size={20} className="shrink-0 mt-0.5" />
                    <p className="text-sm">¡Perfecto! Los saldos coinciden.</p>
                </div>
            )}

            <Input
                label="Saldo Real (según banco)"
                type="number"
                step="0.01"
                placeholder="0"
                error={errors.declaredBalance?.message}
                {...register('declaredBalance', { valueAsNumber: true })}
            />

            {hasDifference && (
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                        type="checkbox"
                        {...register('createAdjustment')}
                        className="rounded"
                    />
                    <span className="text-sm">Crear transacción de ajuste automáticamente</span>
                </label>
            )}

            <div className="flex gap-3 pt-4 justify-end">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                    Reconciliar
                </Button>
            </div>
        </form>
    );
}
