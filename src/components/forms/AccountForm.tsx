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
                // Edit mode (not fully implemented in types for this demo yet, assuming create mainly)
                await db.accounts.update(initialData.id, {
                    ...data,
                    isActive: initialData.isActive ?? true
                });
            } else {
                await db.accounts.add({
                    id: uuidv4(),
                    name: data.name,
                    type: data.type,
                    calculatedBalance: Number(data.calculatedBalance),
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
                label="Saldo actual (Inicial)"
                type="number"
                placeholder="0"
                step="0.01"
                error={errors.calculatedBalance?.message}
                {...register('calculatedBalance', { valueAsNumber: true })}
            />

            <div className="flex gap-3 pt-4 justify-end">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                    Guardar Cuenta
                </Button>
            </div>
        </form>
    );
}
