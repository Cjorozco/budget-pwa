import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLiveQuery } from 'dexie-react-hooks';
import { XCircle, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ReservesListProps {
    accountId: string;
}

export function ReservesList({ accountId }: ReservesListProps) {
    const reserves = useLiveQuery(
        () => db.reserves
            .where('accountId').equals(accountId)
            .and(r => r.isActive)
            .reverse()
            .toArray(),
        [accountId]
    ) || [];

    const handleDeactivate = async (id: string) => {
        if (confirm('¿Deseas eliminar esta reserva? El dinero volverá a estar disponible.')) {
            await db.reserves.update(id, {
                isActive: false,
                updatedAt: Date.now()
            });
        }
    };

    if (reserves.length === 0) {
        return (
            <div className="py-8 text-center text-slate-400">
                <PiggyBank className="mx-auto h-12 w-12 opacity-10 mb-2" />
                <p className="text-sm">No hay reservas activas en esta cuenta.</p>
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
                                Reservado
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            {reserve.description}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                            Creado: {format(reserve.createdAt, "d MMM, yyyy", { locale: es })}
                        </p>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 rounded-full"
                        onClick={() => handleDeactivate(reserve.id)}
                    >
                        <XCircle size={18} />
                    </Button>
                </div>
            ))}
        </div>
    );
}
