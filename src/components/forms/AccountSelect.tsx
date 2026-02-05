import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Wallet } from 'lucide-react';

interface AccountSelectProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    excludeId?: string;
}

export function AccountSelect({ value, onChange, label = 'Cuenta', excludeId }: AccountSelectProps) {
    const accounts = useLiveQuery(() =>
        db.accounts
            .filter(a => a.isActive)
            .toArray()
    );

    const filteredAccounts = accounts?.filter(a => a.id !== excludeId) || [];
    const selectedAccount = accounts?.find(a => a.id === value);

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                >
                    <option value="" disabled>Seleccionar cuenta</option>
                    {filteredAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Wallet size={18} />
                </div>
            </div>

            {selectedAccount && (
                <div className="px-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Saldo actual: <span className="font-medium text-slate-900 dark:text-slate-200">${selectedAccount.calculatedBalance.toLocaleString()}</span>
                    </p>
                </div>
            )}
        </div>
    );
}
