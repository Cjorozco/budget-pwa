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
    Lock,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface UserGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    const sections = [
        {
            icon: <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
            title: t.userGuide.sections.noBankTitle,
            desc: t.userGuide.sections.noBankDesc,
        },
        {
            icon: <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
            title: t.userGuide.sections.atomicBalancesTitle,
            desc: t.userGuide.sections.atomicBalancesDesc,
        },
        {
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
            title: t.userGuide.sections.reconciliationTitle,
            desc: t.userGuide.sections.reconciliationDesc,
        },
        {
            icon: <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
            title: t.userGuide.sections.aiCategorizationTitle,
            desc: t.userGuide.sections.aiCategorizationDesc,
            extraLink: {
                label: t.userGuide.sections.aiKeyStudioLink,
                url: 'https://aistudio.google.com/apikey',
            },
        },
        {
            icon: <PiggyBank className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
            title: t.userGuide.sections.reservesTitle,
            desc: t.userGuide.sections.reservesDesc,
        },
        {
            icon: <Zap className="w-5 h-5 text-amber-500" />,
            title: t.userGuide.sections.quickTemplatesTitle,
            desc: t.userGuide.sections.quickTemplatesDesc,
        },
        {
            icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
            title: t.userGuide.sections.privacyOfflineTitle,
            desc: t.userGuide.sections.privacyOfflineDesc,
        },
    ];

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-6 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[min(90dvh,calc(100dvh-2rem))] flex flex-col shadow-2xl overflow-hidden"
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
                        aria-label={t.userGuide.closeAriaLabel}
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="w-5 h-5 text-blue-200" />
                        <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                            {t.userGuide.modalBadge}
                        </span>
                    </div>

                    <h2 id="guide-modal-title" className="text-xl sm:text-2xl font-black text-white">
                        {t.userGuide.modalTitle}
                    </h2>
                    <p className="text-blue-100 text-xs sm:text-sm mt-1">
                        {t.userGuide.modalSubtitle}
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
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                    >
                        {t.userGuide.closeButton}
                    </button>
                </div>
            </div>
        </div>
    );
};
