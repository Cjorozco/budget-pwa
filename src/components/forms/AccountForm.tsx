import { useForm, Controller } from 'react-hook-form';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { zodResolver } from '@hookform/resolvers/zod';
import { AccountSchema, type AccountFormData } from '@/lib/schemas';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { useUIStore } from '@/store/ui';
import { useTranslation } from '@/lib/i18n';

interface AccountFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: AccountFormData & { id?: string; isActive?: boolean };
}

export function AccountForm({ onSuccess, onCancel, initialData }: AccountFormProps) {
    const { t } = useTranslation();
    const { confirm, addToast } = useUIStore();
    const {
        register,
        control,
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
                label={t.forms.accountNameLabel}
                placeholder={t.forms.accountNamePlaceholder}
                error={errors.name?.message}
                {...register('name')}
            />

            <Select
                label={t.forms.accountTypeLabel}
                options={[
                    { label: t.accounts.accountTypeChecking, value: 'bank' },
                    { label: t.accounts.accountTypeCash, value: 'cash' },
                    { label: t.accounts.accountTypeCredit, value: 'credit' },
                ]}
                error={errors.type?.message}
                {...register('type')}
            />

            <Controller
                name="calculatedBalance"
                control={control}
                render={({ field }) => (
                    <MoneyInput
                        label={t.forms.currentBalanceLabel}
                        placeholder="0"
                        error={errors.calculatedBalance?.message}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value}
                        onValueChange={(v) => field.onChange(v ?? NaN)}
                    />
                )}
            />

            <div className="flex gap-3 pt-4 justify-between">
                <div>
                    {initialData?.id && (
                        <Button
                            type="button"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={async () => {
                                const ok = await confirm({
                                    title: t.forms.resetAccountHistoryTitle,
                                    message: t.forms.resetAccountHistoryMsg,
                                    confirmLabel: t.forms.resetAccountHistory,
                                    variant: 'danger',
                                });
                                if (!ok) return;

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
                                    addToast(t.forms.resetAccountSuccess, 'success');
                                    onSuccess();
                                } catch (error) {
                                    console.error('Error resetting account:', error);
                                    addToast(t.common.error, 'error');
                                }
                            }}
                        >
                            {t.forms.resetAccountHistory}
                        </Button>
                    )}
                </div>
                <div className="flex gap-3">
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        {t.common.cancel}
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        {initialData?.id ? t.forms.updateAccount : t.forms.saveAccount}
                    </Button>
                </div>
            </div>
        </form>
    );
}
