import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AccountSchema, type AccountFormData } from '@/lib/schemas';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface AccountFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: AccountFormData & { id?: string; isActive?: boolean };
}

export function AccountForm({ onSuccess, onCancel, initialData }: AccountFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<AccountFormData>({
        resolver: zodResolver(AccountSchema),
        defaultValues: {
            name: initialData?.name || '',
            type: initialData?.type || 'bank',
            calculatedBalance: initialData?.calculatedBalance || 0,
            currency: 'COP',
        },
    });

    const onSubmit = async (data: AccountFormData) => {
        try {
            if (initialData?.id) {
                // Edit mode
                await db.accounts.update(initialData.id, {
                    ...data,
                    calculatedBalance: Number(data.calculatedBalance),
                    actualBalance: Number(data.calculatedBalance), // Update actual balance too if edited manually
                    isActive: initialData.isActive ?? true
                });
            } else {
                await db.accounts.add({
                    id: uuidv4(),
                    name: data.name,
                    type: data.type,
                    calculatedBalance: Number(data.calculatedBalance),
                    actualBalance: Number(data.calculatedBalance), // Set initial actual balance
                    currency: 'COP',
                    isActive: true,
                });
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving account:', error);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
                label="Nombre de la cuenta"
                placeholder="Ej. Davivienda Nómina"
                error={errors.name?.message}
                {...register('name')}
            />

            <Select
                label="Tipo"
                options={[
                    { label: 'Cuenta Bancaria', value: 'bank' },
                    { label: 'Efectivo', value: 'cash' },
                    { label: 'Tarjeta de Crédito', value: 'credit' },
                ]}
                error={errors.type?.message}
                {...register('type')}
            />

            <Input
                label="Saldo Real en Banco / Efectivo"
                type="number"
                placeholder="0"
                step="0.01"
                error={errors.calculatedBalance?.message}
                {...register('calculatedBalance', { valueAsNumber: true })}
            />

            <div className="flex gap-3 pt-4 justify-between">
                <div>
                    {initialData?.id && (
                        <Button
                            type="button"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={async () => {
                                if (confirm('¿Estás seguro de reiniciar esta cuenta? Se borrarán TODAS las transacciones, reconciliaciones y reservas de esta cuenta.')) {
                                    try {
                                        await db.transaction('rw', [db.transactions, db.reconciliations, db.reserves, db.accounts], async () => {
                                            const id = initialData.id!;
                                            await db.transactions.where('accountId').equals(id).delete();
                                            await db.reconciliations.where('accountId').equals(id).delete();
                                            await db.reserves.where('accountId').equals(id).delete();
                                            await db.accounts.update(id, {
                                                calculatedBalance: 0,
                                                actualBalance: undefined,
                                                lastReconciliationDate: undefined
                                            });
                                        });
                                        onSuccess();
                                    } catch (error) {
                                        console.error('Error resetting account:', error);
                                        alert('Error al reiniciar la cuenta');
                                    }
                                }
                            }}
                        >
                            Reiniciar Historial
                        </Button>
                    )}
                </div>
                <div className="flex gap-3">
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        {initialData?.id ? 'Actualizar Cuenta' : 'Guardar Cuenta'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
