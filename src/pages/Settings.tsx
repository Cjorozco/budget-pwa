import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Trash2, AlertTriangle, RefreshCw, FolderTree } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export default function SettingsPage() {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [actionType, setActionType] = useState<'transactions' | 'full' | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleResetTransactions = async () => {
        setIsLoading(true);
        try {
            await db.transaction('rw', db.transactions, db.accounts, async () => {
                // 1. Clear All Transactions
                await db.transactions.clear();

                // 2. Reset All Account Balances to 0
                await db.accounts.toCollection().modify({ calculatedBalance: 0 });
            });
            alert('¡Transacciones eliminadas y saldos reiniciados a 0!');
            setIsConfirmOpen(false);
        } catch (error) {
            console.error(error);
            alert('Error al reiniciar los datos.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFullReset = async () => {
        setIsLoading(true);
        try {
            await db.delete();
            window.location.reload(); // Reload to trigger seed again
        } catch (error) {
            console.error(error);
            alert('Error al borrar la base de datos.');
            setIsLoading(false);
        }
    };

    const confirmAction = () => {
        if (actionType === 'transactions') handleResetTransactions();
        if (actionType === 'full') handleFullReset();
    };

    return (
        <div className="p-4 safe-bottom space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ajustes</h1>
                <p className="text-sm text-slate-500">Configuración general</p>
            </header>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Gestión</h2>
                <Link to="/categories">
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <FolderTree className="text-blue-600 dark:text-blue-400" size={20} />
                                </div>
                                <div>
                                    <h3 className="font-medium text-slate-900 dark:text-white">Categorías</h3>
                                    <p className="text-xs text-slate-500">Gestiona tus categorías de ingresos y gastos</p>
                                </div>
                            </div>
                            <span className="text-slate-400">→</span>
                        </div>
                    </div>
                </Link>
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Zona de Peligro</h2>
                <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50 rounded-2xl space-y-4">

                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-red-900 dark:text-red-200">Reiniciar Movimientos</h3>
                            <p className="text-xs text-red-700 dark:text-red-300">Borra todas las transacciones y pone los saldos en 0.</p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                setActionType('transactions');
                                setIsConfirmOpen(true);
                            }}
                        >
                            <Trash2 size={16} className="mr-2" />
                            Limpiar
                        </Button>
                    </div>

                    <div className="w-full h-px bg-red-200 dark:bg-red-900/50" />

                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-red-900 dark:text-red-200">Restauración de Fábrica</h3>
                            <p className="text-xs text-red-700 dark:text-red-300">Borra TODO: cuentas, categorías y config.</p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                setActionType('full');
                                setIsConfirmOpen(true);
                            }}
                        >
                            <RefreshCw size={16} className="mr-2" />
                            Reset Total
                        </Button>
                    </div>

                </div>
            </section>

            <Modal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                title={actionType === 'transactions' ? "¿Limpiar Movimientos?" : "¿Restaurar de Fábrica?"}
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl">
                        <AlertTriangle className="shrink-0" />
                        <p className="text-sm">Esta acción <b>no se puede deshacer</b>. Asegúrate de que quieres borrar los datos de prueba.</p>
                    </div>

                    <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={confirmAction}
                            isLoading={isLoading}
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
