import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ReconciliationHistoryProps {
    accountId: string;
}

export function ReconciliationHistory({ accountId }: ReconciliationHistoryProps) {
    const history = useLiveQuery(
        () => db.reconciliations
            .where('accountId')
            .equals(accountId)
            .reverse()
            .sortBy('date')
    );

    if (!history) return <div className="p-8 text-center animate-pulse text-slate-400">Cargando historial...</div>;

    if (history.length === 0) {
        return (
            <div className="p-8 text-center space-y-3">
                <History className="mx-auto h-12 w-12 text-slate-200" />
                <p className="text-slate-500 text-sm">No hay reconciliaciones registradas aún.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {history.map((record) => {
                    const isMatched = Math.abs(record.difference) < 0.01;
                    return (
                        <div
                            key={record.id}
                            className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    {isMatched ? (
                                        <CheckCircle2 size={14} className="text-green-500" />
                                    ) : (
                                        <AlertCircle size={14} className="text-amber-500" />
                                    )}
                                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 italic">
                                        {format(record.date, "d MMM, yyyy - p", { locale: es })}
                                    </span>
                                </div>
                                <div className={`text-xs font-black ${isMatched ? 'text-green-600' : record.difference > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                    {isMatched ? 'SIN DIFERENCIA' : (record.difference > 0 ? '+' : '') + formatCurrency(record.difference)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 mb-2">
                                <div>
                                    <span className="font-medium">Calculado:</span> {formatCurrency(record.calculatedBalance)}
                                </div>
                                <div>
                                    <span className="font-medium">Real:</span> {formatCurrency(record.declaredBalance)}
                                </div>
                            </div>

                            {record.notes && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-800 italic">
                                    "{record.notes}"
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
