import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Trash2, AlertTriangle, RefreshCw, FolderTree, Download, FileJson, FileSpreadsheet, Upload, BookOpen, Compass, Coffee, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { exportDatabase, downloadBackup, importDatabase, exportToCSV, downloadCSV } from '@/lib/db/backup';
import { GeminiKeyCard } from '@/components/settings/GeminiKeyCard';
import { UserGuideModal } from '@/components/settings/UserGuideModal';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { RegionSelector } from '@/components/settings/RegionSelector';
import { useUIStore } from '@/store/ui';
import { useTourStore } from '@/store/tour';
import { useTranslation } from '@/lib/i18n';
import { useLiveQuery } from 'dexie-react-hooks';
import { clearDemoData, hasDemoData } from '@/lib/db/demoMode';
import { SUPPORT_URL } from '@/lib/support';

export default function SettingsPage() {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [actionType, setActionType] = useState<'transactions' | 'full' | 'import' | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [importJson, setImportJson] = useState<string | null>(null);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const { addToast, confirm } = useUIStore();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const tourStart = useTourStore((s) => s.start);

    // The tour begins on the dashboard, where the balance card it points to lives.
    const startTour = () => {
        navigate('/');
        tourStart();
    };

    const demoActive = useLiveQuery(() => hasDemoData());

    const handleClearDemo = async () => {
        const ok = await confirm({
            title: t.demo.clearConfirmTitle,
            message: t.demo.clearConfirmMessage,
            confirmLabel: t.demo.clearConfirmLabel,
            variant: 'danger',
        });
        if (!ok) return;

        setIsLoading(true);
        try {
            await clearDemoData();
            addToast(t.demo.clearSuccess, 'success');
        } catch (error) {
            console.error(error);
            addToast(t.demo.clearError, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportJSON = async () => {
        try {
            const json = await exportDatabase();
            downloadBackup(json);
            addToast(t.settings.backupDownloaded, 'success');
        } catch {
            addToast(t.settings.backupExportError, 'error');
        }
    };

    const handleExportCSV = async () => {
        try {
            const csv = await exportToCSV();
            downloadCSV(csv);
            addToast(t.settings.csvExportSuccess, 'success');
        } catch {
            addToast(t.settings.csvExportError, 'error');
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
            addToast(t.settings.backupRestoredSuccess, 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error(error);
            addToast((error instanceof Error && error.message) || t.settings.backupRestoreError, 'error');
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
            addToast(t.transactions.deleteSuccess, 'success');
            setIsConfirmOpen(false);
        } catch (error) {
            console.error(error);
            addToast(t.transactions.deleteError, 'error');
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
            addToast(t.settings.resetSuccess, 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error(error);
            addToast(t.common.error, 'error');
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
            case 'transactions': return t.settings.confirmResetTransactionsTitle;
            case 'full': return t.settings.confirmResetFullTitle;
            case 'import': return t.settings.confirmRestoreTitle;
            default: return t.settings.confirmActionTitle;
        }
    };

    return (
        <div className="p-4 safe-bottom space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.settings.title}</h1>
                <p className="text-sm text-slate-500">{t.settings.subtitle}</p>
            </header>

            {/* Language Selector */}
            <section>
                <LanguageSelector />
            </section>

            {/* Region and currency */}
            <section>
                <RegionSelector />
            </section>

            {demoActive && (
                <section className="space-y-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.demo.settingsTitle}</h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{t.demo.settingsDesc}</p>
                    <Button
                        type="button"
                        variant="outline"
                        isLoading={isLoading}
                        onClick={handleClearDemo}
                        data-testid="clear-demo-button"
                        className="w-full"
                    >
                        {t.demo.clearButton}
                    </Button>
                </section>
            )}

            {import.meta.env.DEV && (
                <section className="space-y-3 p-4 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30">
                    <h2 className="text-lg font-semibold text-teal-900 dark:text-teal-200">Grabación (solo localhost)</h2>
                    <p className="text-xs text-teal-900 dark:text-teal-300">
                        Carga datos ficticios para el video. No existe en producción. Para regrabar: Reset total → recargar → este botón otra vez.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        isLoading={isLoading}
                        onClick={handleSeedDemoMarketing}
                        data-testid="seed-demo-button"
                        className="w-full border-teal-400 text-teal-900 dark:text-teal-200"
                    >
                        Cargar datos de demo
                    </Button>
                </section>
            )}

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.settings.categoriesSection}</h2>
                <div className="grid grid-cols-1 gap-3">
                    {/* Interactive User Guide */}
                    <button
                        type="button"
                        onClick={() => setIsGuideOpen(true)}
                        className="p-4 bg-teal-50 dark:bg-teal-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left w-full shadow-xs"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                                    <BookOpen size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{t.settings.userGuideSection}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.settings.userGuideDesc}</p>
                                </div>
                            </div>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">→</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={startTour}
                        className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left w-full"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                                <Compass className="text-teal-700 dark:text-teal-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-medium text-slate-900 dark:text-white text-sm">{t.tour.replayTitle}</h3>
                                <p className="text-xs text-slate-500">{t.tour.replayDesc}</p>
                            </div>
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
                                        <h3 className="font-medium text-slate-900 dark:text-white text-sm">{t.settings.manageCategories}</h3>
                                        <p className="text-xs text-slate-500">{t.settings.categoriesDesc}</p>
                                    </div>
                                </div>
                                <span className="text-slate-600 dark:text-slate-400">→</span>
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
                                        <h3 className="font-medium text-slate-900 dark:text-white text-sm">{t.settings.manageTemplates}</h3>
                                        <p className="text-xs text-slate-500">{t.settings.templatesDesc}</p>
                                    </div>
                                </div>
                                <span className="text-slate-600 dark:text-slate-400">→</span>
                            </div>
                        </div>
                    </Link>
                </div>
            </section>

            <section className="space-y-4">
                <GeminiKeyCard />
            </section>

            {SUPPORT_URL && (
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.support.sectionTitle}</h2>
                    <div className="p-5 rounded-2xl text-white shadow-lg relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600">
                        <div className="relative z-10 space-y-3">
                            <p className="text-sm text-white leading-relaxed">{t.support.pitch}</p>
                            <p className="text-xs text-amber-50 leading-relaxed">{t.support.note}</p>
                            <a
                                href={SUPPORT_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-orange-700 shadow-sm transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                            >
                                <Coffee size={16} aria-hidden="true" />
                                {t.support.button}
                                <ExternalLink size={14} aria-hidden="true" />
                            </a>
                        </div>
                        {/* Decorative background elements */}
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                        <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-black/10 rounded-full blur-xl" />
                    </div>
                </section>
            )}

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.settings.backupSection}</h2>
                <div className="grid grid-cols-1 gap-3">
                    <button
                        onClick={handleExportJSON}
                        className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 transition-colors text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                                <FileJson className="text-teal-700 dark:text-teal-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-medium text-slate-900 dark:text-white text-sm">{t.settings.exportJSON}</h3>
                                <p className="text-xs text-slate-500">{t.settings.exportJSONDesc}</p>
                            </div>
                        </div>
                        <Download size={18} className="text-slate-600 dark:text-slate-400" />
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
                                    {t.settings.exportCSV}
                                </h3>
                                <p className="text-xs text-slate-500">{t.settings.exportCSVDesc}</p>
                            </div>
                        </div>
                        <Download size={18} className="text-slate-600 dark:text-slate-400" />
                    </button>

                    <label className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Upload className="text-amber-600 dark:text-amber-400" size={20} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-medium text-slate-900 dark:text-white text-sm">{t.settings.importJSON}</h3>
                                <p className="text-xs text-slate-500">{t.settings.importJSONDesc}</p>
                            </div>
                        </div>
                        <input type="file" accept=".json" onChange={handleFileInput} className="hidden" />
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">{t.settings.uploadButton}</span>
                    </label>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t.settings.dangerZone}</h2>
                <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="font-medium text-red-900 dark:text-red-200 text-sm">{t.settings.resetTransactions}</h3>
                            <p className="text-xs text-red-700 dark:text-red-300">{t.settings.resetTransactionsDesc}</p>
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
                            <h3 className="font-medium text-red-900 dark:text-red-200 text-sm">{t.settings.resetAllData}</h3>
                            <p className="text-xs text-red-700 dark:text-red-300">{t.settings.resetAllDataDesc}</p>
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
                <p className="text-xs text-slate-600 dark:text-slate-500">
                    {t.settings.version} {__APP_VERSION__}
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
                                ? t.settings.overwriteWarning
                                : actionType === 'full'
                                ? t.settings.fullResetWarning
                                : t.settings.transactionsResetWarning}
                        </p>
                    </div>

                    <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>{t.common.cancel}</Button>
                        <Button
                            variant="destructive"
                            onClick={confirmAction}
                            isLoading={isLoading}
                        >
                            {t.common.confirm}
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
