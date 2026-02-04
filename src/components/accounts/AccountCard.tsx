import { Wallet, CreditCard, Banknote, Pencil, History, CheckCircle2, PiggyBank } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Account } from '@/lib/types';

interface AccountCardProps {
    account: Account;
    onEdit: (account: Account) => void;
    onReconcile: (account: Account) => void;
    onViewHistory: (account: Account) => void;
    onAddReserve?: (account: Account) => void;
    onViewReserves?: (account: Account) => void;
}

export function AccountCard({ account, onEdit, onReconcile, onViewHistory, onAddReserve, onViewReserves }: AccountCardProps) {
    const getIcon = (type: string) => {
        switch (type) {
            case 'cash': return Banknote;
            case 'credit': return CreditCard;
            default: return Wallet;
        }
    };

    // Fetch active reserves for this account
    const activeReserves = useLiveQuery(
        () => db.reserves
            .where('accountId').equals(account.id)
            .and(r => r.isActive)
            .toArray(),
        [account.id]
    ) || [];

    const reservedAmount = activeReserves.reduce((sum, r) => sum + r.amount, 0);

    // PRINCIPLE: Available is Truth - Reserved.
    // Truth is account.actualBalance if reconciled, otherwise calculatedBalance.
    const currentTotal = account.actualBalance !== undefined ? account.actualBalance : account.calculatedBalance;
    const availableBalance = currentTotal - reservedAmount;

    const Icon = getIcon(account.type);

    // PRINCIPLE: Difference is always (Actual - Calculated).
    // It represents the discrepancy between reality and system data.
    const difference = account.actualBalance !== undefined
        ? account.actualBalance - account.calculatedBalance
        : null;

    // Tolerance for floating point precision in currency calculations
    const isMatched = difference !== null && Math.abs(difference) < 0.01;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col h-full">
            <div className={cn(
                "absolute top-0 right-0 p-3 opacity-10",
                account.type === 'credit' ? "text-purple-600" : "text-blue-600"
            )}>
                <Icon size={80} />
            </div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2.5 rounded-xl",
                            account.type === 'credit' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" :
                                account.type === 'cash' ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                                    "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                        )}>
                            <Icon size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight text-sm">{account.name}</h3>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                {account.type === 'bank' ? 'Bancaria' : account.type === 'credit' ? 'Crédito' : 'Efectivo'}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                            onClick={() => onEdit(account)}
                            title="Editar"
                        >
                            <Pencil size={14} />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                            onClick={() => onReconcile(account)}
                            title="Reconciliar"
                        >
                            <History size={14} className="text-blue-600" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-full"
                            onClick={() => onAddReserve?.(account)}
                            title="Reservar Dinero"
                        >
                            <PiggyBank size={14} className="text-amber-600" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-4 mt-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block mb-1">Saldo REAL en Banco</span>
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {account.actualBalance !== undefined ? formatCurrency(account.actualBalance) : formatCurrency(account.calculatedBalance)}
                            </div>
                        </div>
                        {reservedAmount > 0 && (
                            <button
                                onClick={() => onViewReserves?.(account)}
                                className="text-left group/res hover:bg-amber-50 dark:hover:bg-amber-900/10 p-1.5 -m-1.5 rounded-xl transition-colors"
                                title="Ver detalles de reservas"
                            >
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-tight block mb-1 group-hover/res:text-amber-600">Reservado</span>
                                <div className="text-sm font-bold text-amber-600 dark:text-amber-400 truncate flex items-center gap-1">
                                    {formatCurrency(reservedAmount)}
                                    <span className="text-[8px] bg-amber-100 dark:bg-amber-900/40 px-1 rounded opacity-0 group-hover/res:opacity-100 transition-opacity">VER</span>
                                </div>
                            </button>
                        )}
                    </div>

                    <div className={cn(
                        "p-3 rounded-xl flex items-center justify-between transition-colors",
                        reservedAmount > 0 ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-100 dark:ring-indigo-900/40" :
                            difference === null ? "bg-slate-50 dark:bg-slate-800/50" :
                                isMatched ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" :
                                    "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    )}>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {reservedAmount > 0 ? 'Disponible' : 'Diferencia'}
                        </span>
                        <span className="text-sm font-black tracking-tight">
                            {reservedAmount > 0 ? formatCurrency(availableBalance) :
                                difference === null ? 'Pendiente' :
                                    (difference > 0 ? '+' : '') + formatCurrency(difference)}
                        </span>
                    </div>

                    {account.lastReconciliationDate && (
                        <button
                            onClick={() => onViewHistory(account)}
                            className="w-full pt-2 flex items-center justify-between group cursor-pointer"
                        >
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium italic group-hover:text-blue-500 transition-colors">
                                <CheckCircle2 size={12} className={cn(isMatched ? "text-green-500" : "text-slate-400 group-hover:text-blue-500")} />
                                <span>
                                    Última: {format(account.lastReconciliationDate, "d MMM, p", { locale: es })}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                Ver historial →
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
