import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { TransactionSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { suggestCategory, type CategorySuggestion } from '@/lib/ai/categorizer';
import { findOrCreateCategory } from '@/lib/ai/categoryResolver';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { format } from 'date-fns';
import { PiggyBank, Sparkles, AlertCircle, FolderPlus } from 'lucide-react';
import { formatCurrency, toSentenceCase } from '@/lib/utils';
import type { Category, Transaction } from '@/lib/types';

type TransactionFormData = z.infer<typeof TransactionSchema>;

interface TransactionFormProps {
    onSuccess: () => void;
    initialData?: Transaction | null;
}

export function TransactionForm({ onSuccess, initialData }: TransactionFormProps) {
    const accounts = useLiveQuery(() => db.accounts.filter(a => a.isActive).toArray()) || [];
    const allCategories = useLiveQuery(() => db.categories.filter(c => c.isActive).toArray()) || [];

    const [aiSuggestion, setAiSuggestion] = useState<CategorySuggestion | null>(null);
    const [showAiSuggestion, setShowAiSuggestion] = useState(false);
    const [createdCategories, setCreatedCategories] = useState<Category[]>([]);
    const categoryTouchedRef = useRef(false);

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
            const suggestion = await suggestCategory(description, type);
            if (suggestion) {
                setAiSuggestion(suggestion);
                setShowAiSuggestion(true);

                if (
                    !categoryTouchedRef.current &&
                    suggestion.categoryId &&
                    !suggestion.needsCategoryCreation &&
                    suggestion.confidence >= 0.7
                ) {
                    setValue('categoryId', suggestion.categoryId);
                    setShowAiSuggestion(false);
                }
            } else {
                setAiSuggestion(null);
                setShowAiSuggestion(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [description, type, initialData, setValue]);

    const handleAcceptSuggestion = async () => {
        if (!aiSuggestion) return;

        try {
            let categoryId = aiSuggestion.categoryId;

            if (aiSuggestion.needsCategoryCreation && aiSuggestion.pendingCategory) {
                const { type: catType, parentName, subcategoryName } = aiSuggestion.pendingCategory;
                categoryId = await findOrCreateCategory(catType, parentName, subcategoryName);

                const created = await db.categories.get(categoryId);
                const extras: Category[] = [];
                if (created) {
                    extras.push(created);
                    if (created.parentId) {
                        const parent = await db.categories.get(created.parentId);
                        if (parent) extras.push(parent);
                    }
                }

                // El <select> nativo descarta valores que aún no están en las opciones.
                flushSync(() => {
                    setCreatedCategories((prev) => {
                        const byId = new Map(prev.map((c) => [c.id, c]));
                        extras.forEach((c) => byId.set(c.id, c));
                        return Array.from(byId.values());
                    });
                });
            }

            if (categoryId) {
                setValue('categoryId', categoryId, { shouldValidate: true, shouldDirty: true });
            }
            setShowAiSuggestion(false);
        } catch (error) {
            console.error('Error creating category:', error);
            alert('No se pudo crear la categoría sugerida');
        }
    };

    // Filter categories by type and organize hierarchically
    const mergedCategories = (() => {
        const byId = new Map<string, Category>();
        allCategories.forEach((c) => byId.set(c.id, c));
        createdCategories.forEach((c) => byId.set(c.id, c));
        return Array.from(byId.values());
    })();
    const categoriesByType = mergedCategories.filter((c) => c.type === type);
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
                        tagIds: [],
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
                        tagIds: [],
                        id: txId,
                        suggestedCategoryId: aiSuggestion?.categoryId ?? undefined,
                        wasCategorySuggestionAccepted: aiSuggestion
                            ? data.categoryId === aiSuggestion.categoryId
                            : false,
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-2">
            <div className="grid grid-cols-2 gap-4">
                <Button
                    type="button"
                    variant={type === 'income' ? 'default' : 'outline'}
                    className={type === 'income' ? 'bg-green-600 hover:bg-green-700 ring-green-600' : ''}
                    onClick={() => {
                        setValue('type', 'income');
                        setValue('categoryId', '');
                        categoryTouchedRef.current = false;
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
                        categoryTouchedRef.current = false;
                    }}
                >
                    Gasto
                </Button>
            </div>

            <Input
                label="Monto"
                type="number"
                placeholder="0"
                autoFocus={!initialData}
                error={errors.amount?.message}
                {...register('amount', { valueAsNumber: true })}
                data-testid="amount-input"
            />

            <Input
                label="Descripción"
                placeholder="Ej: Uber jardín Sofía, Apoyo mamá, Supermercado..."
                error={errors.description?.message}
                {...register('description', {
                    onBlur: (e) => {
                        const formatted = toSentenceCase(e.target.value);
                        setValue('description', formatted, { shouldValidate: true });
                    }
                })}
                data-testid="description-input"
            />

            {/* AI Suggestion Panel */}
            {showAiSuggestion && aiSuggestion && (
                <div
                    data-testid="category-suggestion-panel"
                    className={`
                    p-4 rounded-xl border-2 transition-all duration-300
                    ${aiSuggestion.confidence >= 0.7
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                        : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                    }
                `}
                >
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
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                                <span className="font-semibold">{aiSuggestion.categoryPath}</span>
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                {aiSuggestion.reason}
                            </p>

                            <div className="flex gap-2 mb-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 px-4 text-xs bg-indigo-600 hover:bg-indigo-700"
                                    data-testid="apply-category-button"
                                    onClick={handleAcceptSuggestion}
                                >
                                    {aiSuggestion.needsCategoryCreation ? (
                                        <>
                                            <FolderPlus size={14} className="mr-1" />
                                            Crear y aplicar
                                        </>
                                    ) : (
                                        'Aplicar categoría'
                                    )}
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
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Categoría
                </label>
                <select
                    data-testid="category-select"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    {...register('categoryId', {
                        onChange: () => {
                            categoryTouchedRef.current = true;
                        },
                    })}
                    value={watch('categoryId') ?? ''}
                >
                    <option value="">Selecciona una categoría</option>
                    {parentCategories.map((parent) => {
                        const children = childCategories.filter(c => c.parentId === parent.id);
                        if (children.length > 0) {
                            return (
                                <optgroup key={parent.id} label={parent.name}>
                                    {children.map((child) => (
                                        <option key={child.id} value={child.id}>
                                            {child.name}
                                        </option>
                                    ))}
                                </optgroup>
                            );
                        }
                        return (
                            <option key={parent.id} value={parent.id}>
                                {parent.name}
                            </option>
                        );
                    })}
                </select>
                {errors.categoryId && (
                    <p className="text-sm text-red-600">{errors.categoryId.message}</p>
                )}
            </div>

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

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
                {initialData ? 'Actualizar' : 'Guardar'} transacción
            </Button>
        </form>
    );
}
