import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { v4 as uuidv4 } from 'uuid';
import type { Account } from '@/lib/types';
import { PiggyBank } from 'lucide-react';
import { useUIStore } from '@/store/ui';

const ReserveSchema = z.object({
    amount: z.number().min(1, 'El monto debe ser mayor a 0'),
    description: z.string().min(3, 'Descripción requerida (ej: EPM Marzo)'),
});

type ReserveFormData = z.infer<typeof ReserveSchema>;

interface ReserveFormProps {
    account: Account;
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: {
        id: string;
        amount: number;
        description: string;
    };
}

export function ReserveForm({ account, onSuccess, onCancel, initialData }: ReserveFormProps) {
    const addToast = useUIStore((s) => s.addToast);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ReserveFormData>({
        resolver: zodResolver(ReserveSchema),
        defaultValues: initialData || {
            amount: undefined,
            description: '',
        },
    });

    const onSubmit = async (data: ReserveFormData) => {
        try {
            if (initialData?.id) {
                await db.reserves.update(initialData.id, {
                    amount: data.amount,
                    description: data.description,
                    updatedAt: Date.now(),
                });
                addToast('Reserva actualizada', 'success');
            } else {
                await db.reserves.add({
                    id: uuidv4(),
                    accountId: account.id,
                    amount: data.amount,
                    description: data.description,
                    isActive: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
                addToast('Reserva creada', 'success');
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving reserve:', error);
            addToast(initialData?.id ? 'Error al editar la reserva' : 'Error al crear la reserva', 'error');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                <PiggyBank className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                    <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                        Esta reserva reducirá tu <b>Saldo Disponible</b> pero NO afectará tu saldo real ni tus ahorros.
                    </p>
                </div>
            </div>

            <Input
                label="Monto a Reservar"
                type="number"
                step="0.01"
                placeholder="0"
                autoFocus
                error={errors.amount?.message}
                {...register('amount', { valueAsNumber: true })}
            />

            <Input
                label="Descripción / Propósito"
                placeholder="Ej: Factura EPM Marzo"
                error={errors.description?.message}
                {...register('description')}
            />

            <div className="flex gap-3 pt-4 justify-end">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                    {initialData?.id ? 'Guardar Cambios' : 'Crear Reserva'}
                </Button>
            </div>
        </form>
    );
}
