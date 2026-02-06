import { useState } from 'react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { AccountSelect } from './AccountSelect';
import { v4 as uuidv4 } from 'uuid';
import { ArrowRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface TransferFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export function TransferForm({ onSuccess, onCancel }: TransferFormProps) {
    const [sourceAccountId, setSourceAccountId] = useState('');
    const [destinationAccountId, setDestinationAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceAccountId || !destinationAccountId || !amount) return;

        setIsLoading(true);
        try {
            const transferId = uuidv4();
            const numericAmount = parseFloat(amount);
            const timestamp = new Date(date).getTime();

            await db.transaction('rw', db.transactions, db.accounts, async () => {
                // Get account names for the unified description
                const sourceAccount = await db.accounts.get(sourceAccountId);
                const destAccount = await db.accounts.get(destinationAccountId);

                // Unified description: e.g., "Transferencia: Bancolombia ➔ Efectivo"
                const unifiedDescription = `Transferencia: ${sourceAccount?.name} ➔ ${destAccount?.name}`;

                // 1. Outgoing Transaction (Source)
                await db.transactions.add({
                    id: uuidv4(),
                    transferId,
                    type: 'transfer', // Distinct type
                    amount: numericAmount, // Positive value stored, UI handles display
                    description: unifiedDescription,
                    date: timestamp,
                    categoryId: 'transfer-out',
                    tagIds: [],
                    accountId: sourceAccountId,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });

                // 2. Incoming Transaction (Destination)
                await db.transactions.add({
                    id: uuidv4(),
                    transferId,
                    type: 'transfer',
                    amount: numericAmount,
                    description: unifiedDescription,
                    date: timestamp,
                    categoryId: 'transfer-in',
                    tagIds: [],
                    accountId: destinationAccountId,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });

                // 3. Update Balances
                const source = await db.accounts.get(sourceAccountId);
                const dest = await db.accounts.get(destinationAccountId);

                if (source) {
                    const updates: any = {
                        calculatedBalance: source.calculatedBalance - numericAmount
                    };
                    // Also update actualBalance to prevent creating a "Difference" gap
                    if (typeof source.actualBalance === 'number') {
                        updates.actualBalance = source.actualBalance - numericAmount;
                    }
                    await db.accounts.update(sourceAccountId, updates);
                }

                if (dest) {
                    const updates: any = {
                        calculatedBalance: dest.calculatedBalance + numericAmount
                    };
                    // Also update actualBalance to prevent creating a "Difference" gap
                    if (typeof dest.actualBalance === 'number') {
                        updates.actualBalance = dest.actualBalance + numericAmount;
                    }
                    await db.accounts.update(destinationAccountId, updates);
                }
            });

            onSuccess();
        } catch (error) {
            console.error('Error executing transfer:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                <AccountSelect
                    label="Desde"
                    value={sourceAccountId}
                    onChange={setSourceAccountId}
                    excludeId={destinationAccountId}
                />
                <div className="pt-6 text-slate-400">
                    <ArrowRight size={20} />
                </div>
                <AccountSelect
                    label="Para"
                    value={destinationAccountId}
                    onChange={setDestinationAccountId}
                    excludeId={sourceAccountId}
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Monto a transferir</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        required
                        min="1"
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-8 py-4 text-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-300"
                        placeholder="0.00"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha</label>
                <div className="relative">
                    <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pl-10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Calendar size={18} />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nota (opcional)</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                    placeholder="Motivo de la transferencia..."
                />
            </div>

            <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    isLoading={isLoading}
                    disabled={!sourceAccountId || !destinationAccountId || !amount}
                >
                    Transferir
                </Button>
            </div>
        </form>
    );
}
