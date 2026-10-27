import React, { useState } from 'react';
import { X, Check, Sparkles, Key, ExternalLink, ShieldCheck, Coffee, Heart, Bot } from 'lucide-react';
import { useLicenseStore } from '../../store/licenseStore';
import { useUIStore } from '../../store/ui';
import { useTranslation } from '../../lib/i18n';

const LEMON_SQUEEZY_CHECKOUT_URL: string = import.meta.env.VITE_LEMON_CHECKOUT_URL;

export const UpgradeModal: React.FC = () => {
    const {
        isPro,
        expiresAt,
        isUpgradeModalOpen,
        upgradeModalReason,
        closeUpgradeModal,
        activateLicense,
        deactivateLicense,
    } = useLicenseStore();
    const { addToast } = useUIStore();
    const { t } = useTranslation();

    const [licenseInput, setLicenseInput] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [activeTab, setActiveTab] = useState<'support' | 'key'>('support');

    if (!isUpgradeModalOpen) return null;

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActivating(true);

        try {
            const result = await activateLicense(licenseInput);
            setIsActivating(false);

            if (result.success) {
                addToast(result.message, 'success');
                setLicenseInput('');
            } else {
                addToast(result.message, 'error');
            }
        } catch {
            setIsActivating(false);
            addToast('Ocurrió un error al verificar la licencia.', 'error');
        }
    };

    const handleCheckout = () => {
        window.open(LEMON_SQUEEZY_CHECKOUT_URL, '_blank', 'noopener,noreferrer');
        addToast('Redirigiendo a la pasarela segura de Lemon Squeezy...', 'info');
    };

    const handleDeactivate = async () => {
        const confirmed = await useUIStore.getState().confirm({
            title: '¿Desvincular Licencia?',
            message: '¿Estás seguro de desactivar tu licencia en este dispositivo? Volverás al plan básico. Podrás volver a vincular tu clave en cualquier momento sin costo adicional.',
            confirmLabel: 'Desvincular Licencia',
            cancelLabel: 'Cancelar',
            variant: 'danger',
        });

        if (confirmed) {
            deactivateLicense();
            addToast('Licencia desactivada. Has vuelto al plan básico.', 'info');
        }
    };

    const features = [
        { icon: Check, color: 'text-emerald-500', text: t.upgradeModal.featureUnlimitedAccounts },
        { icon: Bot, color: 'text-blue-500', text: t.upgradeModal.featureAiCategorization },
        { icon: Check, color: 'text-emerald-500', text: t.upgradeModal.featureAmbiguousReview },
        { icon: Check, color: 'text-emerald-500', text: t.upgradeModal.featureQuickTemplates },
        { icon: Check, color: 'text-emerald-500', text: t.upgradeModal.featureAdvancedReports },
    ];

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-6 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                onClick={closeUpgradeModal}
                aria-hidden="true"
            />

            <div
                className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[min(90dvh,calc(100dvh-2rem))] flex flex-col shadow-2xl overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upgrade-modal-title"
            >
                {/* Header */}
                <div className="relative p-5 text-white flex-shrink-0 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500">
                    <button
                        type="button"
                        onClick={closeUpgradeModal}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 mb-1">
                        {isPro ? <Heart className="w-5 h-5 text-yellow-200" /> : <Coffee className="w-5 h-5 text-yellow-200" />}
                        <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                            {isPro ? t.upgradeModal.activeMembership : t.upgradeModal.plansTab}
                        </span>
                    </div>

                    <h2 id="upgrade-modal-title" className="text-xl sm:text-2xl font-black text-white">
                        {t.upgradeModal.modalTitle}
                    </h2>
                    <p className="text-amber-100 text-xs sm:text-sm mt-1">
                        {isPro ? t.upgradeModal.proMemberDesc : upgradeModalReason || t.upgradeModal.modalSubtitle}
                    </p>
                </div>

                {/* Sub-header Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('support')}
                        className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                            activeTab === 'support'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <Coffee className="w-4 h-4" />
                        {isPro ? t.upgradeModal.activeMembership : t.upgradeModal.plansTab}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('key')}
                        className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                            activeTab === 'key'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <Key className="w-4 h-4" />
                        {isPro ? t.settings.manageLicense : t.upgradeModal.keyTab}
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {/* Status Badge */}
                    {isPro && (
                        <div className="p-3.5 rounded-xl border flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <div>
                                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                    Personal Budget PRO
                                </p>
                                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                    {/* Only legacy subscription licenses carry an expiry date. */}
                                    {expiresAt
                                        ? `Licencia activa hasta el ${new Date(expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}.`
                                        : 'Licencia permanente sin fecha de expiración.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'support' ? (
                        <>
                            {!isPro && (
                                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 space-y-1.5">
                                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                        {t.upgradeModal.supportPitch}
                                    </p>
                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                        {t.upgradeModal.oneTimeNote}
                                    </p>
                                </div>
                            )}

                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 space-y-2.5 border border-slate-200/80 dark:border-slate-800">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-500" />
                                    {t.upgradeModal.featuresHeader}
                                </p>
                                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                    {features.map(({ icon: Icon, color, text }) => (
                                        <li key={text} className="flex items-start gap-2">
                                            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${color}`} />
                                            <span>{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {!isPro && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleCheckout}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-98"
                                    >
                                        <Coffee className="w-4 h-4" />
                                        <span>{t.upgradeModal.checkoutButton}</span>
                                        <ExternalLink className="w-4 h-4" />
                                    </button>

                                    <p className="text-xs text-center text-slate-600 dark:text-slate-500 flex items-center justify-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        {t.upgradeModal.securePaymentNote}
                                    </p>
                                </>
                            )}
                        </>
                    ) : (
                        /* License Key Tab */
                        <form onSubmit={handleActivate} className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                                    {isPro ? 'Información de tu Licencia Actual' : '¿Ya hiciste tu aporte o recibiste una clave?'}
                                </p>
                                <p>
                                    {isPro
                                        ? 'Tu licencia actual está guardada de forma segura en este navegador. Si deseas transferirla o cambiarla, ingresa la nueva clave a continuación.'
                                        : 'Pega la clave de licencia recibida por correo electrónico de Lemon Squeezy para activar la app inmediatamente.'}
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="license-input"
                                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                                >
                                    {t.upgradeModal.enterKeyLabel}
                                </label>
                                <input
                                    id="license-input"
                                    type="text"
                                    value={licenseInput}
                                    onChange={(e) => setLicenseInput(e.target.value)}
                                    placeholder={t.upgradeModal.keyPlaceholder}
                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono uppercase"
                                    required
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={isActivating || !licenseInput.trim()}
                                    className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
                                >
                                    <Key className="w-4 h-4" />
                                    {isActivating ? t.upgradeModal.verifying : t.upgradeModal.activateButton}
                                </button>

                                {isPro && (
                                    <button
                                        type="button"
                                        onClick={handleDeactivate}
                                        className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                                    >
                                        {t.upgradeModal.deactivateButton}
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
