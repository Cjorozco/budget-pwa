import React, { useState } from 'react';
import {
    X,
    Check,
    Sparkles,
    Zap,
    Flame,
    Key,
    ExternalLink,
    ShieldCheck,
    CreditCard,
    Star,
    Award,
} from 'lucide-react';
import { useLicenseStore, type PlanType, getTierDisplayName } from '../../store/licenseStore';
import { useUIStore } from '../../store/ui';

const LEMON_SQUEEZY_CHECKOUT_URL = 'https://orzixtech.lemonsqueezy.com/checkout/buy/c45c6116-d975-43d9-9995-cc8811d926f7';

export const UpgradeModal: React.FC = () => {
    const {
        tier,
        isPro,
        isUpgradeModalOpen,
        upgradeModalReason,
        closeUpgradeModal,
        activateLicense,
        deactivateLicense,
        themeMode,
        setThemeMode,
    } = useLicenseStore();
    const { addToast } = useUIStore();

    const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');
    const [licenseInput, setLicenseInput] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [activeTab, setActiveTab] = useState<'plans' | 'key'>('plans');

    if (!isUpgradeModalOpen) return null;

    const isDbz = themeMode === 'dbz';

    const handleActivate = (e: React.FormEvent) => {
        e.preventDefault();
        setIsActivating(true);

        const result = activateLicense(licenseInput);
        setIsActivating(false);

        if (result.success) {
            addToast(result.message, 'success');
            setLicenseInput('');
        } else {
            addToast(result.message, 'error');
        }
    };

    const handleCheckout = () => {
        window.open(LEMON_SQUEEZY_CHECKOUT_URL, '_blank', 'noopener,noreferrer');
        addToast('Redirigiendo a la pasarela segura de Lemon Squeezy...', 'info');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upgrade-modal-title"
            >
                {/* Header */}
                <div className="relative p-5 bg-linear-to-r from-amber-500 via-orange-500 to-rose-500 text-white flex-shrink-0">
                    <button
                        type="button"
                        onClick={closeUpgradeModal}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 mb-1">
                        {isDbz ? <Zap className="w-6 h-6 text-yellow-200 animate-pulse" /> : <Sparkles className="w-6 h-6 text-yellow-200" />}
                        <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                            {isDbz ? 'Evolución de Poder' : 'Desbloquea el Potencial'}
                        </span>
                    </div>

                    <h2 id="upgrade-modal-title" className="text-xl sm:text-2xl font-black text-white">
                        {isDbz ? '¡Conviértete en Super Saiyajin!' : 'Personal Budget PRO'}
                    </h2>
                    <p className="text-amber-100 text-xs sm:text-sm mt-1">
                        {upgradeModalReason || 'Automatiza tus finanzas con IA, cuentas ilimitadas y análisis profesional.'}
                    </p>

                    {/* Mode Toggle (Estándar vs DBZ) */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/20 text-xs">
                        <span className="text-amber-100 flex items-center gap-1">
                            {isDbz ? '⚡ Temática: Dragon Ball Z' : '✨ Temática: Estándar'}
                        </span>
                        <button
                            type="button"
                            onClick={() => setThemeMode(isDbz ? 'classic' : 'dbz')}
                            className="px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 text-white font-medium transition-colors text-[11px]"
                        >
                            Cambiar a {isDbz ? 'Modo Estándar' : 'Modo Saiyajin'}
                        </button>
                    </div>
                </div>

                {/* Sub-header Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('plans')}
                        className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                            activeTab === 'plans'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <CreditCard className="w-4 h-4" />
                        Planes y Precios
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
                        Tengo una Clave de Licencia
                    </button>
                </div>

                {/* Body Content (Scrollable) */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {/* Status if already PRO */}
                    {isPro && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                        Estado Activo: {getTierDisplayName(tier, themeMode)}
                                    </p>
                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                        Disfrutas de todas las características desbloqueadas.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={deactivateLicense}
                                className="text-[10px] text-slate-500 hover:text-rose-600 underline font-medium"
                            >
                                Desactivar
                            </button>
                        </div>
                    )}

                    {activeTab === 'plans' ? (
                        <>
                            {/* Pricing Cards Selector */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {/* Monthly */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlan('monthly')}
                                    className={`relative p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                                        selectedPlan === 'monthly'
                                            ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-amber-500/20'
                                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30'
                                    }`}
                                >
                                    <div>
                                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Mensual</p>
                                        <p className="text-[11px] text-slate-500">Flexibilidad total</p>
                                        <div className="mt-2">
                                            <span className="text-lg font-black text-slate-900 dark:text-slate-100">$0.99</span>
                                            <span className="text-[11px] text-slate-500"> /mes</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                        ~ $3.900 COP
                                    </p>
                                </button>

                                {/* Annual (Featured) */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlan('annual')}
                                    className={`relative p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                                        selectedPlan === 'annual'
                                            ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 ring-2 ring-amber-500/30'
                                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30'
                                    }`}
                                >
                                    <div className="absolute -top-2.5 right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                                        -33% OFF
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Anual</p>
                                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                        </div>
                                        <p className="text-[11px] text-slate-500">Recomendado</p>
                                        <div className="mt-2">
                                            <span className="text-lg font-black text-slate-900 dark:text-slate-100">$7.99</span>
                                            <span className="text-[11px] text-slate-500"> /año</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                                        ~$29.900 COP (~$2.490/m)
                                    </p>
                                </button>

                                {/* Lifetime */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlan('lifetime')}
                                    className={`relative p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                                        selectedPlan === 'lifetime'
                                            ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-amber-500/20'
                                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30'
                                    }`}
                                >
                                    <div className="absolute -top-2.5 right-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                                        1 Solo Pago
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Lifetime</p>
                                            <Award className="w-3 h-3 text-rose-500" />
                                        </div>
                                        <p className="text-[11px] text-slate-500">Para siempre</p>
                                        <div className="mt-2">
                                            <span className="text-lg font-black text-slate-900 dark:text-slate-100">$19.99</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                        ~ $79.000 COP
                                    </p>
                                </button>
                            </div>

                            {/* Feature Comparison */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 space-y-2 border border-slate-200/80 dark:border-slate-800">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                    {isDbz ? 'Habilidades de Super Saiyajin (PRO):' : 'Lo que obtienes con PRO:'}
                                </p>
                                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span><strong>Cuentas y Reservas Ilimitadas</strong> (Bancos, Efectivo, Tarjetas)</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span><strong>Categorización con IA</strong> (Gemini / Groq / Anthropic)</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span><strong>Revisión de Transacciones Ambiguas</strong> y dudosas</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span><strong>Plantillas Rápidas (1-Tap)</strong> y Tags ilimitados</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span><strong>Reportes Avanzados</strong> y Exportación completa a CSV/Excel</span>
                                    </li>
                                </ul>

                                {/* Future Nivel God Teaser */}
                                <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1 font-medium">
                                        <Flame className="w-3.5 h-3.5 text-rose-500" />
                                        {isDbz ? 'Próximamente Nivel GOD:' : 'Próximamente Nivel GOD:'} OCR Recibos + Extractos PDF
                                    </span>
                                </div>
                            </div>

                            {/* Checkout Button */}
                            <button
                                type="button"
                                onClick={handleCheckout}
                                className="w-full py-3 px-4 bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-98"
                            >
                                <span>
                                    {isDbz ? 'Desbloquear Poder Super Saiyajin' : 'Obtener Personal Budget PRO'}
                                </span>
                                <ExternalLink className="w-4 h-4" />
                            </button>

                            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                Pago seguro internacional con Lemon Squeezy (Tarjetas, Apple Pay, Google Pay).
                            </p>
                        </>
                    ) : (
                        /* License Key Tab */
                        <form onSubmit={handleActivate} className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                                    ¿Ya compraste tu suscripción o licencia?
                                </p>
                                <p>
                                    Pega la clave de licencia que recibiste por correo electrónico de Lemon Squeezy para activar la app al instante.
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="license-input"
                                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                                >
                                    Clave de Licencia
                                </label>
                                <input
                                    id="license-input"
                                    type="text"
                                    value={licenseInput}
                                    onChange={(e) => setLicenseInput(e.target.value)}
                                    placeholder="ej. PRO-XXXX-XXXX-XXXX o DEMO-PRO"
                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono uppercase"
                                    required
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Tip para demostración: Puedes probar escribiendo <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-600">DEMO-PRO</code> o <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-rose-600">DEMO-GOD</code>.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isActivating || !licenseInput.trim()}
                                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                <Key className="w-4 h-4" />
                                {isActivating ? 'Verificando...' : 'Activar Licencia Ahora'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
