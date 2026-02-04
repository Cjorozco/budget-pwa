import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Trash2, AlertTriangle, RefreshCw, FolderTree, Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { exportDatabase, downloadBackup, importDatabase, exportToCSV, downloadCSV } from '@/lib/db/backup';
import { useUIStore } from '@/store/ui';

export default function SettingsPage() {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [actionType, setActionType] = useState<'transactions' | 'full' | 'import' | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [importJson, setImportJson] = useState<string | null>(null);
    const addToast = useUIStore(s => s.addToast);

    const handleExportJSON = async () => {
        try {
            const json = await exportDatabase();
            downloadBackup(json);
            addToast('Backup descargado con éxito', 'success');
        } catch (error) {
            addToast('Error al exportar backup', 'error');
        }
    };

    const handleExportCSV = async () => {
        try {
            const csv = await exportToCSV();
            downloadCSV(csv);
            addToast('Movimientos exportados a CSV', 'success');
        } catch (error) {
            addToast('Error al exportar CSV', 'error');
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setImportJson(content);
            setActionType('import');
            setIsConfirmOpen(true);
        };
        reader.readAsText(file);
    };

    const handleDoImport = async () => {
        if (!importJson) return;
        setIsLoading(true);
        try {
            await importDatabase(importJson);
            addToast('¡Respaldo restaurado con éxito!', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
            console.error(error);
            addToast(error.message || 'Error al restaurar respaldo', 'error');
            setIsConfirmOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetTransactions = async () => {
        setIsLoading(true);
        try {
            await db.transaction('rw', db.transactions, db.accounts, async () => {
                await db.transactions.clear();
                await db.accounts.toCollection().modify({ calculatedBalance: 0 });
            });
            addToast('Movimientos eliminados correctamente', 'success');
            setIsConfirmOpen(false);
        } catch (error) {
            console.error(error);
            addToast('Error al reiniciar movimientos', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFullReset = async () => {
        setIsLoading(true);
        try {
            await db.delete();
            addToast('Base de datos borrada completamente', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error(error);
            addToast('Error al borrar la base de datos', 'error');
            setIsLoading(false);
        }
    };

    const confirmAction = () => {
        if (actionType === 'transactions') handleResetTransactions();
        if (actionType === 'full') handleFullReset();
        if (actionType === 'import') handleDoImport();
    };

    const getModalTitle = () => {
        switch (actionType) {
            case 'transactions': return "¿Reset Cuenta?";
            case 'full': return "¿Reset Total?";
            case 'import': return "¿Restaurar Respaldo?";
            default: return "Confirmar acción";
        }
    };

    return (
        <div className="p-4 safe-bottom space-y-6 pb-20">
            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ajustes</h1>
                <p className="text-sm text-slate-500">Configuración general</p>
            </header>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Gestión</h2>
                <div className="grid grid-cols-1 gap-3">
                    <Link to="/categories" className="block">
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left w-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <FolderTree className="text-blue-600 dark:text-blue-400" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-900 dark:text-white text-sm">Categorías</h3>
                                        <p className="text-[10px] text-slate-500">Gestiona tus categorías de ingresos y gastos</p>
                                    </div>
                                </div>
                                <span className="text-slate-400">→</span>
                            </div>
                        </div>
                    </Link>

                    <Link to="/templates" className="block">
                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left w-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                        <RefreshCw className="text-purple-600 dark:text-purple-400" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-900 dark:text-white text-sm">Plantillas Rápidas</h3>
                                        <p className="text-[10px] text-slate-500">Configura accesos rápidos para tus gastos frecuentes</p>
                                    </div>
                                </div>
                                <span className="text-slate-400">→</span>
                            </div>
                        </div>
                    </Link>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Portabilidad de Datos</h2>
                <div className="grid grid-cols-1 gap-3">
                    <button
                        onClick={handleExportJSON}
                        className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 transition-colors text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                <FileJson className="text-indigo-600 dark:text-indigo-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-medium text-slate-900 dark:text-white text-sm">Exportar Respaldo (JSON)</h3>
                                <p className="text-[10px] text-slate-500">Copia completa de tu base de datos</p>
                            </div>
                        </div>
                        <Download size={18} className="text-slate-400" />
                    </button>

                    <button
                        onClick={handleExportCSV}
                        className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 transition-colors text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <FileSpreadsheet className="text-green-600 dark:text-green-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-medium text-slate-900 dark:text-white text-sm">Exportar a Excel (CSV)</h3>
                                <p className="text-[10px] text-slate-500">Solo transacciones para análisis externo</p>
                            </div>
                        </div>
                        <Download size={18} className="text-slate-400" />
                    </button>

                    <label className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Upload className="text-amber-600 dark:text-amber-400" size={20} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-medium text-slate-900 dark:text-white text-sm">Importar Respaldo</h3>
                                <p className="text-[10px] text-slate-500">Restaura datos desde un archivo .json</p>
                            </div>
                        </div>
                        <input type="file" accept=".json" onChange={handleFileInput} className="hidden" />
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">SUBIR</span>
                    </label>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Zona de Peligro</h2>
                <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="font-medium text-red-900 dark:text-red-200 text-sm">Reset cuenta</h3>
                            <p className="text-[10px] text-red-700 dark:text-red-300">Borra todas las transacciones y pone los saldos en 0.</p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                                setActionType('transactions');
                                setIsConfirmOpen(true);
                            }}
                        >
                            <Trash2 size={16} />
                        </Button>
                    </div>

                    <div className="w-full h-px bg-red-200 dark:bg-red-900/50" />

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="font-medium text-red-900 dark:text-red-200 text-sm">Reset total</h3>
                            <p className="text-[10px] text-red-700 dark:text-red-300">Borra TODO: cuentas, categorías y config.</p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                                setActionType('full');
                                setIsConfirmOpen(true);
                            }}
                        >
                            <RefreshCw size={16} />
                        </Button>
                    </div>
                </div>
            </section>

            <Modal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                title={getModalTitle()}
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl">
                        <AlertTriangle className="shrink-0" />
                        <p className="text-sm">
                            {actionType === 'import'
                                ? "Se sobrescribirán todos los datos actuales con el contenido del archivo de respaldo."
                                : "Esta acción no se puede deshacer. Los datos se borrarán permanentemente."}
                        </p>
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
