import React from 'react';
import {
    X,
    BookOpen,
    Scale,
    Bot,
    PiggyBank,
    Zap,
    ShieldCheck,
    CheckCircle2,
    ExternalLink,
} from 'lucide-react';

interface UserGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const sections = [
        {
            icon: <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
            title: '1. Saldos Atómicos y Trazabilidad Total',
            desc: 'En Personal Budget, el saldo de tus cuentas no es un número editable: se calcula sumando y restando matemáticamente cada una de tus transacciones históricas. De esta forma nunca hay descuadres inexplicables ni pérdida de información.',
        },
        {
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
            title: '2. Conciliación Bancaria sin Borrar el Pasado',
            desc: 'Al conciliar una cuenta (ej. Bancolombia o tu cuenta de ahorros), ingresas el saldo real que ves en la app de tu banco. Si existe una diferencia, la app crea una transacción de ajuste explícita para que tu balance cuadre perfectamente sin alterar transacciones pasadas.',
        },
        {
            icon: <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
            title: '3. Categorización Inteligente con IA (PRO - BYOK)',
            desc: 'La versión PRO te permite conectar tu propia API Key gratuita de Google AI Studio (Gemini), Groq Cloud o Anthropic Claude. La IA analiza la descripción de tu gasto y autocompleta la categoría sugerida directamente desde tu navegador sin enviar datos a servidores intermediarios.',
            extraLink: {
                label: 'Obtener API Key gratis en Google AI Studio',
                url: 'https://aistudio.google.com/apikey',
            },
        },
        {
            icon: <PiggyBank className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
            title: '4. Fondos de Reserva y Metas de Ahorro',
            desc: 'Puedes apartar dinero dentro de cualquier cuenta para metas específicas (fondo de emergencia, viajes, impuestos). El saldo total de tu banco permanece intacto, pero la app te muestra tu "saldo disponible real" para no gastar lo reservado.',
        },
        {
            icon: <Zap className="w-5 h-5 text-amber-500" />,
            title: '5. Plantillas Rápidas (1-Tap)',
            desc: 'Configura plantillas para tus gastos frecuentes (almuerzo diario, transporte, café). Con un solo toque en la pantalla de inicio o formulario, la transacción se autocompleta al instante ahorrándote tiempo.',
        },
        {
            icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
            title: '6. Privacidad Offline-First y Respaldo de Datos',
            desc: 'Tus finanzas son 100% privadas y residen únicamente en la base de datos de tu dispositivo (IndexedDB). Puedes exportar un respaldo completo en archivo JSON o exportar a CSV para Excel en cualquier momento desde Ajustes.',
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="guide-modal-title"
            >
                {/* Header */}
                <div className="relative p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors"
                        aria-label="Cerrar manual"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="w-5 h-5 text-blue-200" />
                        <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                            Manual de Usuario
                        </span>
                    </div>

                    <h2 id="guide-modal-title" className="text-xl sm:text-2xl font-black text-white">
                        Guía de Uso y Filosofía
                    </h2>
                    <p className="text-blue-100 text-xs sm:text-sm mt-1">
                        Aprende cómo aprovechar al máximo cada funcionalidad de Personal Budget.
                    </p>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {sections.map((sec, idx) => (
                        <div
                            key={idx}
                            className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-xs border border-slate-200/50 dark:border-slate-700/50">
                                    {sec.icon}
                                </div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                    {sec.title}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-1">
                                {sec.desc}
                            </p>
                            {sec.extraLink && (
                                <a
                                    href={sec.extraLink.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1 pl-1"
                                >
                                    <span>{sec.extraLink.label}</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
                    >
                        Entendido, cerrar guía
                    </button>
                </div>
            </div>
        </div>
    );
};
