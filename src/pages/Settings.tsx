import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Trash2, AlertTriangle, RefreshCw, FolderTree, Download, FileJson, FileSpreadsheet, Upload, Crown, Lock, BookOpen, Bot, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { exportDatabase, downloadBackup, importDatabase, exportToCSV, downloadCSV } from '@/lib/db/backup';
import { GeminiKeyCard } from '@/components/settings/GeminiKeyCard';
import { UserGuideModal } from '@/components/settings/UserGuideModal';
import { useLicenseStore, getTierDisplayName } from '@/store/licenseStore';
import { useUIStore } from '@/store/ui';
import { ProBadge } from '@/components/ui/ProBadge';

export default function SettingsPage() {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [actionType, setActionType] = useState<'transactions' | 'full' | 'import' | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [importJson, setImportJson] = useState<string | null>(null);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const { addToast, confirm } = useUIStore();
    const { tier, isPro, openUpgradeModal } = useLicenseStore();

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
        if (!isPro) {
            openUpgradeModal('La exportación a formato CSV/Excel requiere Personal Budget PRO.');
            return;
        }
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

    const handleSeedDemoMarketing = async () => {
        if (!import.meta.env.DEV) return;

        const ok = await confirm({
            title: '¿Cargar datos demo para marketing?',
            message: 'Esto BORRA movimientos, reservas y reconciliaciones de este localhost y carga datos ficticios de demo.\n\nNo afecta producción. ¿Continuar?',
            confirmLabel: 'Cargar Demo',
            variant: 'danger',
        });
        if (!ok) return;

        setIsLoading(true);
        try {
            const { seedDemoMarketing } = await import('@/lib/db/seedDemoMarketing');
            const result = await seedDemoMarketing();
            addToast('Datos de demo cargados', 'success');
            await confirm({
                title: 'Demo lista',
                message: `En Cuentas → Reconciliar Bancolombia, escribe:\n${result.bancolombiaDeclaredOnCamera.toLocaleString('es-CO')} COP\n\n(calculado ${result.bancolombiaCalculated.toLocaleString('es-CO')} + 35.000)\n\nLuego, en cámara, crea un gasto nuevo: "Uber al jardín".`,
                confirmLabel: 'Entendido, recargar',
                cancelLabel: 'Cerrar',
                variant: 'primary',
            });
            window.location.reload();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error al sembrar demo';
            addToast(message, 'error');
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
            case 'transactions': return "¿Reset cuenta?";
            case 'full': return "¿Reset total?";
            case 'import': return "¿Restaurar respaldo?";
            default: return "Confirmar acción";
        }
    };

    return (
        <div className="p-4 safe-bottom space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ajustes</h1>
                <p className="text-sm text-slate-500">Configuración general</p>
            </header>

            {import.meta.env.DEV && (
                <section className="space-y-3 p-4 rounded-2xl border-2 border-dashed border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30">
                    <h2 className="text-lg font-semibold text-violet-900 dark:text-violet-200">Grabación (solo localhost)</h2>
                    <p className="text-xs text-violet-800 dark:text-violet-300">
                        Carga datos ficticios para el video. No existe en producción. Para regrabar: Reset total → recargar → este botón otra vez.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        isLoading={isLoading}
                        onClick={handleSeedDemoMarketing}
                        data-testid="seed-demo-button"
                        className="w-full border-violet-400 text-violet-800 dark:text-violet-200"
                    >
                        Cargar datos de demo
                    </Button>
                </section>
            )}

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ayuda y Gestión</h2>
                <div className="grid grid-cols-1 gap-3">
                    {/* Interactive User Guide */}
                    <button
                        type="button"
                        onClick={() => setIsGuideOpen(true)}
                        className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left w-full shadow-xs"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                                    <BookOpen size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Manual de Usuario y Guía</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Aprende a usar saldos atómicos, conciliación y categorización</p>
                                </div>
                            </div>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">Abrir →</span>
                        </div>
                    </button>

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
                                        <h3 className="font-medium text-slate-900 dark:text-white text-sm">Plantillas rápidas</h3>
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
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Suscripción y Licencia</h2>
                <div className="p-5 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 rounded-2xl text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Crown size={22} className="text-yellow-200" />
                                <h3 className="font-bold text-lg text-white">
                                    {getTierDisplayName(tier)}
                                </h3>
                            </div>
                            <ProBadge size="md" />
                        </div>

                        <p className="text-xs text-amber-50 leading-relaxed opacity-95">
                            {isPro
                                ? `¡Tienes activas todas las funciones de Personal Budget PRO! Cuentas ilimitadas, categorización con IA (BYOK), plantillas 1-tap y exportación.`
                                : "Desbloquea categorización automática con IA (usando tu API key de Gemini, Groq o Claude), cuentas y reservas ilimitadas y exportación a CSV/Excel."}
                        </p>

                        <div className="pt-1">
                            <Button
                                onClick={() => openUpgradeModal()}
                                className="bg-white text-orange-600 hover:bg-amber-50 font-bold border-none shadow-sm text-xs py-2 px-3.5"
                            >
                                {isPro ? "Ver Estado / Gestionar Licencia" : "Ver Planes y Precios ($0.99 / mes)"}
                            </Button>
                        </div>
                    </div>
                    {/* Decorative background elements */}
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-black/10 rounded-full blur-xl" />
                </div>

                {/* AI Configuration: Show GeminiKeyCard if PRO, or PRO Locked Teaser if FREE */}
                {isPro ? (
                    <GeminiKeyCard />
                ) : (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <Bot className="text-blue-600 dark:text-blue-400" size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Categorización Inteligente con IA</h3>
                                    <p className="text-[11px] text-slate-500">Google Gemini · Groq · Anthropic Claude</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                                <Lock size={12} />
                                <span>PRO</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            Al actualizar a <strong>Personal Budget PRO</strong>, podrás ingresar tu clave de API gratuita (BYOK) para que la inteligencia artificial sugiera categorías automáticamente mientras escribes tus gastos, con 100% de privacidad en tu navegador.
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openUpgradeModal('Desbloquea categorización automática con IA')}
                            className="w-full text-xs"
                        >
                            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Desbloquear Categorización con IA
                        </Button>
                    </div>
                )}
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Portabilidad de datos</h2>
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
                                <h3 className="font-medium text-slate-900 dark:text-white text-sm">Exportar respaldo (JSON)</h3>
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
                                <h3 className="font-medium text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                                    Exportar a Excel (CSV)
                                    {!isPro && <Lock size={14} className="text-amber-500" />}
                                </h3>
                                <p className="text-[10px] text-slate-500">Solo transacciones para análisis externo</p>
                            </div>
                        </div>
                        {!isPro ? (
                            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded">PRO</div>
                        ) : (
                            <Download size={18} className="text-slate-400" />
                        )}
                    </button>

                    <label className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Upload className="text-amber-600 dark:text-amber-400" size={20} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-medium text-slate-900 dark:text-white text-sm">Importar respaldo</h3>
                                <p className="text-[10px] text-slate-500">Restaura datos desde un archivo .json</p>
                            </div>
                        </div>
                        <input type="file" accept=".json" onChange={handleFileInput} className="hidden" />
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">SUBIR</span>
                    </label>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Zona de peligro</h2>
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

            <footer className="pt-2 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                    Versión {__APP_VERSION__}
                </p>
            </footer>

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

            <UserGuideModal
                isOpen={isGuideOpen}
                onClose={() => setIsGuideOpen(false)}
            />
        </div>
    );
}
