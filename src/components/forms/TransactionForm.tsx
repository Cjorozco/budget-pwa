import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { TransactionSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TagSelector } from './TagSelector';
import { suggestCategoryAndTags } from '@/lib/ai/categorizer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { format } from 'date-fns';
import { PiggyBank, Sparkles, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/lib/types';

type TransactionFormData = z.infer<typeof TransactionSchema>;

interface TransactionFormProps {
    onSuccess: () => void;
    initialData?: Transaction | null;
}

export function TransactionForm({ onSuccess, initialData }: TransactionFormProps) {
    const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive).toArray()) || [];
    const allCategories = useLiveQuery(() => db.categories.filter(c => c.isActive).toArray()) || [];

    const [aiSuggestion, setAiSuggestion] = useState<any>(null);
    const [showAiSuggestion, setShowAiSuggestion] = useState(false);

    const toTitleCase = (str: string) => {
        return str
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<TransactionFormData>({
        resolver: zodResolver(TransactionSchema) as any,
        defaultValues: initialData ? {
            amount: initialData.amount,
            description: initialData.description,
            type: initialData.type,
            accountId: initialData.accountId,
            categoryId: initialData.categoryId,
            date: initialData.date,
            tagIds: initialData.tagIds || [],
        } : {
            amount: undefined,
            description: '',
            type: 'expense',
            date: Date.now(),
            tagIds: [],
        } as any,
    });

    const type = watch('type');
    const description = watch('description');
    const tagIds = watch('tagIds') || [];
    const accountId = watch('accountId');

    // Fetch active reserves for the selected account
    const activeReserves = useLiveQuery(
        () => accountId
            ? db.reserves.where('accountId').equals(accountId).and(r => r.isActive).toArray()
            : Promise.resolve([] as any[]),
        [accountId]
    ) || [];

    // AI Suggestions Logic
    useEffect(() => {
        if (initialData) return; // Don't suggest when editing
        if (!description || description.length < 3) {
            setAiSuggestion(null);
            setShowAiSuggestion(false);
            return;
        }

        const timer = setTimeout(async () => {
            const suggestion = await suggestCategoryAndTags(description, type);
            if (suggestion) {
                setAiSuggestion(suggestion);
                setShowAiSuggestion(true);
            } else {
                setAiSuggestion(null);
                setShowAiSuggestion(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [description, type, initialData]);

    const handleAcceptSuggestion = () => {
        if (!aiSuggestion) return;
        setValue('categoryId', aiSuggestion.categoryId);
        if (aiSuggestion.tagIds.length > 0) {
            setValue('tagIds', aiSuggestion.tagIds);
        }
        setShowAiSuggestion(false);
    };

    // Filter categories by type and organize hierarchically
    const categoriesByType = allCategories.filter((c) => c.type === type);
    const parentCategories = categoriesByType
        .filter(c => !c.parentId)
        .sort((a, b) => a.name.localeCompare(b.name));

    const childCategories = categoriesByType
        .filter(c => c.parentId)
        .sort((a, b) => a.name.localeCompare(b.name));

    const onSubmit = async (data: TransactionFormData) => {
        try {
            if (initialData?.id) {
                // EDIT MODE: Calculate balance delta
                await db.transaction('rw', db.transactions, db.accounts, async () => {
                    const oldTx = initialData;

                    // Reverse old transaction effect
                    // 1. Reverse old transaction effect
                    const account = await db.accounts.get(oldTx.accountId);
                    if (account) {
                        let newCalcBalance = account.calculatedBalance;
                        let newActualBalance = account.actualBalance;

                        // Reverse old effect
                        if (oldTx.type === 'income') {
                            newCalcBalance -= oldTx.amount;
                            if (newActualBalance !== undefined) newActualBalance -= oldTx.amount;
                        } else {
                            newCalcBalance += oldTx.amount;
                            if (newActualBalance !== undefined) newActualBalance += oldTx.amount;
                        }

                        // Apply new effect (if same account)
                        if (data.accountId === oldTx.accountId) {
                            if (data.type === 'income') {
                                newCalcBalance += data.amount;
                                if (newActualBalance !== undefined) newActualBalance += data.amount;
                            } else {
                                newCalcBalance -= data.amount;
                                if (newActualBalance !== undefined) newActualBalance -= data.amount;
                            }

                            await db.accounts.update(oldTx.accountId, {
                                calculatedBalance: newCalcBalance,
                                actualBalance: newActualBalance,
                            });
                        } else {
                            // Different account - update both separately
                            await db.accounts.update(oldTx.accountId, {
                                calculatedBalance: newCalcBalance,
                                actualBalance: newActualBalance,
                            });

                            const newAccount = await db.accounts.get(data.accountId);
                            if (newAccount) {
                                let targetCalc = newAccount.calculatedBalance;
                                let targetActual = newAccount.actualBalance;

                                if (data.type === 'income') {
                                    targetCalc += data.amount;
                                    if (targetActual !== undefined) targetActual += data.amount;
                                } else {
                                    targetCalc -= data.amount;
                                    if (targetActual !== undefined) targetActual -= data.amount;
                                }

                                await db.accounts.update(data.accountId, {
                                    calculatedBalance: targetCalc,
                                    actualBalance: targetActual,
                                });
                            }
                        }
                    }

                    // Update transaction
                    await db.transactions.update(initialData.id, {
                        ...data,
                        updatedAt: Date.now(),
                    });
                });
            } else {
                // CREATE MODE
                await db.transaction('rw', db.transactions, db.accounts, db.reserves, async () => {
                    // Enrich with AI metadata if applicable
                    const txId = uuidv4();
                    const finalData = {
                        ...data,
                        id: txId,
                        suggestedCategoryId: aiSuggestion?.categoryId,
                        wasCategorySuggestionAccepted: aiSuggestion && data.categoryId === aiSuggestion.categoryId,
                        aiConfidence: aiSuggestion?.confidence,
                        isAmbiguous: aiSuggestion ? aiSuggestion.confidence < 0.7 : false,
                        needsReview: aiSuggestion ? aiSuggestion.confidence < 0.5 : false,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    };

                    // 1. Create Transaction
                    await db.transactions.add(finalData as any);

                    // 2. Update Account Balance
                    const account = await db.accounts.get(data.accountId);
                    if (account) {
                        const amount = data.amount;
                        const isIncome = data.type === 'income';

                        const newCalcBalance = isIncome
                            ? account.calculatedBalance + amount
                            : account.calculatedBalance - amount;

                        const updateData: any = { calculatedBalance: newCalcBalance };

                        if (account.actualBalance !== undefined) {
                            updateData.actualBalance = isIncome
                                ? account.actualBalance + amount
                                : account.actualBalance - amount;
                        }

                        await db.accounts.update(data.accountId, updateData);
                    }

                    // 3. Fulfill Reserve if selected
                    if (data.fulfilledReserveId) {
                        await db.reserves.update(data.fulfilledReserveId, {
                            isActive: false,
                            fulfilledAt: Date.now(),
                            fulfilledTransactionId: txId,
                            updatedAt: Date.now(),
                        });
                    }
                });
            }

            reset();
            onSuccess();
        } catch (error) {
            console.error('Failed to save transaction:', error);
            alert('Error al guardar la transacción');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Button
                    type="button"
                    variant={type === 'income' ? 'default' : 'outline'}
                    className={type === 'income' ? 'bg-green-600 hover:bg-green-700 ring-green-600' : ''}
                    onClick={() => {
                        setValue('type', 'income');
                        setValue('categoryId', '');
                    }}
                >
                    Ingreso
                </Button>
                <Button
                    type="button"
                    variant={type === 'expense' ? 'default' : 'outline'}
                    className={type === 'expense' ? 'bg-red-600 hover:bg-red-700 ring-red-600' : ''}
                    onClick={() => {
                        setValue('type', 'expense');
                        setValue('categoryId', '');
                    }}
                >
                    Gasto
                </Button>
            </div>

            <Input
                label="Monto"
                type="number"
                placeholder="0"
                autoFocus
                error={errors.amount?.message}
                {...register('amount', { valueAsNumber: true })}
            />

            <Input
                label="Descripción"
                placeholder="¿Qué fue?"
                error={errors.description?.message}
                {...register('description', {
                    onBlur: (e) => {
                        const formatted = toTitleCase(e.target.value);
                        setValue('description', formatted);
                    }
                })}
            />

            {/* AI Suggestion Panel */}
            {showAiSuggestion && aiSuggestion && (
                <div className={`
                    p-4 rounded-xl border-2 transition-all animate-in fade-in slide-in-from-top-2 duration-300
                    ${aiSuggestion.confidence >= 0.7
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                        : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                    }
                `}>
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${aiSuggestion.confidence >= 0.7 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40'}`}>
                            {aiSuggestion.confidence >= 0.7 ? <Sparkles size={18} /> : <AlertCircle size={18} />}
                        </div>

                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {aiSuggestion.confidence >= 0.7 ? 'Sugerencia mágica' : 'Revisión necesaria'}
                                </p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${aiSuggestion.confidence >= 0.7 ? 'bg-blue-200 text-blue-700' : 'bg-amber-200 text-amber-700'}`}>
                                    {Math.round(aiSuggestion.confidence * 100)}%
                                </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                                {aiSuggestion.reason}
                            </p>

                            <div className="flex gap-2 mb-3">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 px-4 text-xs bg-indigo-600 hover:bg-indigo-700"
                                    onClick={handleAcceptSuggestion}
                                >
                                    Aplicar todo
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-4 text-xs"
                                    onClick={() => setShowAiSuggestion(false)}
                                >
                                    Ignorar
                                </Button>
                            </div>

                            {/* Optional: Individual Tag Suggestions if they aren't all applied or for more context */}
                            {aiSuggestion.tagIds.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-blue-100 dark:border-blue-800">
                                    <span className="text-[10px] font-medium text-slate-500 w-full mb-1">Tags sugeridos:</span>
                                    {aiSuggestion.tagIds.map((tid: string) => (
                                        <SuggestedTagBadge
                                            key={tid}
                                            tagId={tid}
                                            onAdd={() => {
                                                if (!tagIds.includes(tid)) {
                                                    setValue('tagIds', [...tagIds, tid]);
                                                }
                                            }}
                                            isSelected={tagIds.includes(tid)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Cuenta
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    {...register('accountId')}
                >
                    <option value="">Selecciona una cuenta</option>
                    {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
                {errors.accountId && (
                    <p className="text-sm text-red-600">{errors.accountId.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Categoría
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    {...register('categoryId')}
                >
                    <option value="">Selecciona una categoría</option>
                    {parentCategories.map((parent) => {
                        const children = childCategories.filter(c => c.parentId === parent.id);
                        if (children.length > 0) {
                            // Parent has children - show as optgroup
                            return (
                                <optgroup key={parent.id} label={parent.name}>
                                    {children.map((child) => (
                                        <option key={child.id} value={child.id}>
                                            {child.name}
                                        </option>
                                    ))}
                                </optgroup>
                            );
                        } else {
                            // Parent has no children - show as regular option
                            return (
                                <option key={parent.id} value={parent.id}>
                                    {parent.name}
                                </option>
                            );
                        }
                    })}
                </select>
                {errors.categoryId && (
                    <p className="text-sm text-red-600">{errors.categoryId.message}</p>
                )}
            </div>

            <Input
                label="Fecha"
                type="date"
                defaultValue={format(watch('date') || Date.now(), 'yyyy-MM-dd')}
                onChange={(e) => {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    const date = new Date(y, m - 1, d).getTime();
                    if (!isNaN(date)) {
                        setValue('date', date);
                    }
                }}
            />

            {/* Reserve Fulfillment Selector */}
            {type === 'expense' && activeReserves.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                        <PiggyBank size={14} />
                        ¿Cumplir una reserva?
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-amber-200 dark:border-amber-800 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        {...register('fulfilledReserveId')}
                    >
                        <option value="">No, es un gasto nuevo</option>
                        {activeReserves.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.description} ({formatCurrency(r.amount)})
                            </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-amber-700 dark:text-amber-500 italic">
                        Selecciona si este gasto es el pago de algo que ya habías reservado.
                    </p>
                </div>
            )}

            <TagSelector
                selectedTagIds={tagIds}
                onChange={(ids) => setValue('tagIds', ids)}
            />

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
                {initialData ? 'Actualizar' : 'Guardar'} transacción
            </Button>
        </form>
    );
}

function SuggestedTagBadge({ tagId, onAdd, isSelected }: { tagId: string, onAdd: () => void, isSelected: boolean }) {
    const tag = useLiveQuery(() => db.tags.get(tagId), [tagId]);
    if (!tag) return null;

    return (
        <button
            type="button"
            onClick={onAdd}
            disabled={isSelected}
            className={`
                px-2 py-1 rounded-full text-[10px] font-bold border transition-all
                ${isSelected
                    ? 'bg-slate-200 border-slate-300 text-slate-500 cursor-default'
                    : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50 dark:bg-slate-800 dark:border-blue-900'
                }
            `}
        >
            {isSelected ? '✓ ' : '+ '}{tag.name}
        </button>
    );
}
