import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { XCircle, PiggyBank, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Reserve } from '@/lib/types';
import { useUIStore } from '@/store/ui';
import { useTranslation, getDateFnsLocale } from '@/lib/i18n';

interface ReservesListProps {
    accountId: string;
    onEditReserve?: (reserve: Reserve) => void;
}

export function ReservesList({ accountId, onEditReserve }: ReservesListProps) {
    const { t, language } = useTranslation();
    const dateLocale = getDateFnsLocale(language);
    const { confirm, addToast } = useUIStore();
    const reserves = useLiveQuery(
        () => db.reserves
            .where('accountId').equals(accountId)
            .and(r => r.isActive)
            .reverse()
            .toArray(),
        [accountId]
    ) || [];

    const handleDeactivate = async (id: string) => {
        const ok = await confirm({
            title: t.forms.deleteReserveTitle,
            message: t.forms.deleteReserveMsg,
            confirmLabel: t.common.delete,
            variant: 'danger',
        });
        if (!ok) return;

        try {
            await db.reserves.update(id, {
                isActive: false,
                updatedAt: Date.now()
            });
            addToast(t.forms.reserveDeleted, 'success');
        } catch (error) {
            console.error('Error deactivating reserve:', error);
            addToast(t.common.error, 'error');
        }
    };

    if (reserves.length === 0) {
        return (
            <div className="py-8 text-center text-slate-400">
                <PiggyBank className="mx-auto h-12 w-12 opacity-10 mb-2" />
                <p className="text-sm">{t.forms.noActiveReserves}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {reserves.map((reserve) => (
                <div
                    key={reserve.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                >
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {formatCurrency(reserve.amount)}
                            </span>
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                {t.accounts.reservedLabel}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            {reserve.description}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                            {t.forms.createdDate.replace('{date}', format(reserve.createdAt, "d MMM, yyyy", { locale: dateLocale }))}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-300 hover:text-blue-500 rounded-full"
                            onClick={() => onEditReserve?.(reserve)}
                            title={t.common.edit}
                        >
                            <Pencil size={16} />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 rounded-full"
                            onClick={() => handleDeactivate(reserve.id)}
                            title={t.common.delete}
                        >
                            <XCircle size={18} />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
