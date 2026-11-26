import { format } from 'date-fns';
import type { Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export function ReviewEvidence({ movements, label }: { movements: Transaction[]; label: string }) {
    return (
        <details className="text-sm">
            <summary className="min-h-11 cursor-pointer content-center">{label.replace('{n}', String(movements.length))}</summary>
            <ul className="divide-y divide-current/15">
                {movements.map((tx) => (
                    <li key={tx.id} className="flex flex-wrap justify-between gap-x-3 py-2">
                        <span className="min-w-0 break-words">{tx.description}</span>
                        <span className="text-text-muted">{format(tx.date, 'yyyy-MM-dd')} · {formatCurrency(tx.amount)}</span>
                    </li>
                ))}
            </ul>
        </details>
    );
}
