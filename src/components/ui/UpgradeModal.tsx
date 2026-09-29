import React, { useState } from 'react';
import {
    X,
    Check,
    Sparkles,
    Flame,
    Key,
    ExternalLink,
    ShieldCheck,
    CreditCard,
    Star,
    Award,
    Bot,
} from 'lucide-react';
import { useLicenseStore, type PlanType, getTierDisplayName } from '../../store/licenseStore';
import { useUIStore } from '../../store/ui';

const LEMON_SQUEEZY_CHECKOUT_URL = 'https://orzixtech.lemonsqueezy.com/checkout/buy/c45c6116-d975-43d9-9995-cc8811d926f7';

export const UpgradeModal: React.FC = () => {
    const {
        tier,
        isPro,
        isGod,
        planType,
        isUpgradeModalOpen,
        upgradeModalReason,
        closeUpgradeModal,
        activateLicense,
        deactivateLicense,
    } = useLicenseStore();
    const { addToast } = useUIStore();

    const [selectedPlan, setSelectedPlan] = useState<PlanType>(
        planType === 'monthly' ? 'annual' : planType === 'annual' ? 'lifetime' : 'annual'
    );
    const [licenseInput, setLicenseInput] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [activeTab, setActiveTab] = useState<'plans' | 'key'>('plans');

    if (!isUpgradeModalOpen) return null;

    const isLifetimePro = isPro && planType === 'lifetime' && !isGod;

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
                <div className={`relative p-5 text-white flex-shrink-0 ${
                    isGod 
                        ? 'bg-gradient-to-r from-rose-600 via-purple-600 to-amber-600' 
                        : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
                }`}>
                    <button
                        type="button"
                        onClick={closeUpgradeModal}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 mb-1">
                        {isGod ? <Flame className="w-5 h-5 text-yellow-200" /> : <Sparkles className="w-5 h-5 text-yellow-200" />}
                        <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                            {isGod ? 'Nivel Máximo Activo' : isLifetimePro ? 'Membresía Activa' : isPro ? 'Plan Activo' : 'Desbloquea el Potencial'}
                        </span>
                    </div>

                    <h2 id="upgrade-modal-title" className="text-xl sm:text-2xl font-black text-white">
                        {isGod
                            ? 'Personal Budget GOD'
                            : isLifetimePro
                            ? '¡Eres Miembro PRO Lifetime!'
                            : isPro
                            ? 'Personal Budget PRO'
                            : 'Personal Budget PRO'}
                    </h2>
                    <p className="text-amber-100 text-xs sm:text-sm mt-1">
                        {isGod
                            ? 'Tienes activo el nivel más alto. Incluye todas las funcionalidades de Personal Budget y mejoras continuas.'
                            : isLifetimePro
                            ? 'Tienes acceso permanente a todas las características profesionales.'
                            : upgradeModalReason || 'Automatiza tus finanzas con IA, cuentas ilimitadas y análisis profesional.'}
                    </p>
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
                        {isGod || isLifetimePro ? 'Mis Beneficios y Estado' : 'Planes y Precios'}
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
                        {isPro ? 'Gestionar Licencia' : 'Tengo una Clave'}
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {/* Status Badge */}
                    {isPro && (
                        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                            isGod
                                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                <ShieldCheck className={`w-5 h-5 shrink-0 ${isGod ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                                <div>
                                    <p className={`text-xs font-bold ${isGod ? 'text-purple-900 dark:text-purple-200' : 'text-emerald-900 dark:text-emerald-200'}`}>
                                        Nivel Activo: {getTierDisplayName(tier)}
                                        {isGod && ' (Nivel Máximo)'}
                                        {!isGod && planType === 'lifetime' && ' (Vitalicio / Lifetime)'}
                                        {!isGod && planType === 'annual' && ' (Suscripción Anual)'}
                                        {!isGod && planType === 'monthly' && ' (Suscripción Mensual)'}
                                    </p>
                                    <p className={`text-[11px] ${isGod ? 'text-purple-700 dark:text-purple-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                        {isGod
                                            ? 'Todas las características actuales y sus actualizaciones incluidas.'
                                            : planType === 'lifetime'
                                            ? 'Licencia permanente sin fecha de expiración.'
                                            : 'Todas las características PRO desbloqueadas.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'plans' ? (
                        <>
                            {/* CASE 1: USER IS GOD */}
                            {isGod ? (
                                <div className="space-y-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs uppercase tracking-wider">
                                            <Flame className="w-4 h-4 text-purple-500" />
                                            <span>Poderes Desbloqueados en Nivel GOD:</span>
                                        </div>
                                        <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                                            <li className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <span><strong>Cuentas y Reservas Ilimitadas:</strong> Múltiples bancos, tarjetas y fondos.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Bot className="w-4 h-4 text-purple-500 shrink-0" />
                                                <span><strong>Categorización con IA (BYOK):</strong> Soporte para API keys gratuitas y de pago de Gemini, Groq y Claude.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <span><strong>Revisión de Transacciones Ambiguas</strong> y detección de movimientos dudosos.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <span><strong>Plantillas Rápidas (1-Tap)</strong> y Tags ilimitados.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <span><strong>Reportes Avanzados y Exportación CSV/Excel</strong> para tu contabilidad.</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="p-3.5 bg-purple-50/80 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 flex items-center gap-2">
                                        <Award className="w-4 h-4 text-purple-600 shrink-0" />
                                        <span>Tienes el nivel máximo. Todas las mejoras y actualizaciones de las características existentes están incluidas.</span>
                                    </div>
                                </div>
                            ) : isLifetimePro ? (
                                /* CASE 2: USER IS LIFETIME PRO */
                                <div className="space-y-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                                            <Award className="w-4 h-4" />
                                            <span>Funcionalidades Desbloqueadas en tu Cuenta:</span>
                                        </div>
                                        <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                                            <li className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <span><strong>Cuentas y Reservas Ilimitadas:</strong> Múltiples bancos, tarjetas y fondos de ahorro.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Bot className="w-4 h-4 text-blue-500 shrink-0" />
                                                <span><strong>Categorización con IA (BYOK):</strong> Usa tus API Keys gratuitas o de pago de Gemini, Groq o Claude con privacidad total.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <span><strong>Revisión de Transacciones Ambiguas</strong> y detección de movimientos dudosos.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <span><strong>Plantillas Rápidas (1-Tap)</strong> y Tags personalizados ilimitados.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                <span><strong>Reportes Avanzados y Exportación CSV/Excel</strong> para tu contabilidad.</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Future Nivel GOD Teaser with Discount Promise */}
                                    <div className="p-4 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-2">
                                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs">
                                            <Flame className="w-4 h-4 text-rose-500" />
                                            <span>Próximamente: Personal Budget GOD</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                            Incluirá escaneo de recibos y facturas mediante cámara (OCR), importador inteligente de extractos bancarios PDF/Excel y asistente financiero autónomo.
                                        </p>
                                        <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                                            <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                                            <span>🎁 Por ser usuario Lifetime PRO, tendrás acceso a un descuento preferencial para actualizar a GOD.</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* CASE 3: USER IS FREE OR MONTHLY/ANNUAL UPGRADE */
                                <>
                                    {/* Pricing Options */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        {/* Monthly (only show if free) */}
                                        {planType !== 'monthly' && planType !== 'annual' && (
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
                                                    <p className="text-[11px] text-slate-500">Flexibilidad mes a mes</p>
                                                    <div className="mt-2">
                                                        <span className="text-lg font-black text-slate-900 dark:text-slate-100">$0.99</span>
                                                        <span className="text-[11px] text-slate-500"> USD/m</span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                                    ~ $3.900 COP/mes
                                                </p>
                                            </button>
                                        )}

                                        {/* Annual (show if free or monthly) */}
                                        {planType !== 'annual' && (
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
                                                    <p className="text-[11px] text-slate-500">Ahorra 33% al año</p>
                                                    <div className="mt-2">
                                                        <span className="text-lg font-black text-slate-900 dark:text-slate-100">$7.99</span>
                                                        <span className="text-[11px] text-slate-500"> USD/año</span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                                                    ~$29.900 COP (~$2.490/m)
                                                </p>
                                            </button>
                                        )}

                                        {/* Lifetime (always available for upgrade) */}
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
                                                Pago Único
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1">
                                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Lifetime</p>
                                                    <Award className="w-3 h-3 text-rose-500" />
                                                </div>
                                                <p className="text-[11px] text-slate-500">De por vida</p>
                                                <div className="mt-2">
                                                    <span className="text-lg font-black text-slate-900 dark:text-slate-100">$19.99</span>
                                                    <span className="text-[11px] text-slate-500"> USD</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                                ~ $79.000 COP
                                            </p>
                                        </button>
                                    </div>

                                    {/* Feature Details with clear AI BYOK explanation */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 space-y-2.5 border border-slate-200/80 dark:border-slate-800">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                            Lo que desbloqueas con Personal Budget PRO:
                                        </p>
                                        <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                            <li className="flex items-start gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                <span><strong>Cuentas y Reservas Ilimitadas:</strong> Administra todas tus fuentes de dinero y fondos de ahorro.</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <Bot className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                                <span>
                                                    <strong>Categorización con IA (BYOK):</strong> Conecta tu API key (gratuita o de pago) de Google AI Studio, Groq o Claude para categorizar tus gastos automáticamente con total privacidad en tu navegador.
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                <span><strong>Revisión de Transacciones Ambiguas:</strong> Filtro inteligente para movimientos dudosos.</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                <span><strong>Plantillas Rápidas (1-Tap)</strong> y Tags ilimitados.</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                <span><strong>Exportación completa a CSV/Excel:</strong> Lleva tus datos a hojas de cálculo.</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Checkout Button */}
                                    <button
                                        type="button"
                                        onClick={handleCheckout}
                                        className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-98"
                                    >
                                        <span>
                                            {planType === 'monthly' || planType === 'annual'
                                                ? 'Actualizar Plan con Lemon Squeezy'
                                                : 'Obtener Personal Budget PRO'}
                                        </span>
                                        <ExternalLink className="w-4 h-4" />
                                    </button>

                                    <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        Pago seguro con Lemon Squeezy (Tarjetas de crédito/débito, Apple Pay, Google Pay).
                                    </p>
                                </>
                            )}
                        </>
                    ) : (
                        /* License Key Tab */
                        <form onSubmit={handleActivate} className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                                    {isPro ? 'Información de tu Licencia Actual' : '¿Ya compraste tu suscripción o recibiste una clave?'}
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
                                    Clave de Licencia
                                </label>
                                <input
                                    id="license-input"
                                    type="text"
                                    value={licenseInput}
                                    onChange={(e) => setLicenseInput(e.target.value)}
                                    placeholder="ej. c45c6116-d975-43d9-9995-cc8811d926f7 o PRO-XXXX-XXXX"
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
                                    {isActivating ? 'Verificando...' : 'Activar Licencia'}
                                </button>

                                {isPro && (
                                    <button
                                        type="button"
                                        onClick={handleDeactivate}
                                        className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                                    >
                                        Desactivar
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
