import { useForm, Controller } from 'react-hook-form';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { v4 as uuidv4 } from 'uuid';
import type { Account } from '@/lib/types';
import { now } from '@/lib/utils';
import { PiggyBank } from 'lucide-react';
import { useUIStore } from '@/store/ui';
import { useTranslation } from '@/lib/i18n';

const ReserveSchema = z.object({
    amount: z.number().min(1, 'Amount must be greater than 0'),
    description: z.string().min(3, 'Description required'),
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
    const { t } = useTranslation();
    const addToast = useUIStore((s) => s.addToast);
    const {
        register,
        control,
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
                    updatedAt: now(),
                });
                addToast(t.forms.reserveUpdated, 'success');
            } else {
                await db.reserves.add({
                    id: uuidv4(),
                    accountId: account.id,
                    amount: data.amount,
                    description: data.description,
                    isActive: true,
                    createdAt: now(),
                    updatedAt: now(),
                });
                addToast(t.forms.reserveCreated, 'success');
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving reserve:', error);
            addToast(t.common.error, 'error');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                <PiggyBank className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                    <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                        {t.forms.reserveHint}
                    </p>
                </div>
            </div>

            <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                    <MoneyInput
                        label={t.forms.reserveAmountLabel}
                        placeholder="0"
                        autoFocus
                        error={errors.amount?.message}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value}
                        onValueChange={(v) => field.onChange(v ?? NaN)}
                    />
                )}
            />

            <Input
                label={t.forms.reserveDescLabel}
                placeholder={t.forms.reserveDescPlaceholder}
                error={errors.description?.message}
                {...register('description')}
            />

            <div className="flex gap-3 pt-4 justify-end">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    {t.common.cancel}
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                    {initialData?.id ? t.forms.updateReserve : t.forms.saveReserve}
                </Button>
            </div>
        </form>
    );
}
