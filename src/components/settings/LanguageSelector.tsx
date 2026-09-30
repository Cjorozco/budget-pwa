import { useTranslation, type SupportedLanguage } from '@/lib/i18n';
import { Globe, Check } from 'lucide-react';

export const LanguageSelector: React.FC = () => {
    const { language, setLanguage, languages, t } = useTranslation();

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
                    <Globe className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {t.settings.languageSection}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.settings.languageDesc}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
                {languages.map((lang) => {
                    const isSelected = language === lang.code;
                    return (
                        <button
                            key={lang.code}
                            type="button"
                            onClick={() => setLanguage(lang.code as SupportedLanguage)}
                            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                                isSelected
                                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="text-xl" role="img" aria-label={lang.label}>
                                    {lang.flag}
                                </span>
                                <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                        {lang.label}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {lang.description}
                                    </p>
                                </div>
                            </div>
                            {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
