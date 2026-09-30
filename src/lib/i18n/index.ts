import { useI18nStore } from './i18nStore';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, type TranslationSchema } from './types';
import { es } from './translations/es';
import { en } from './translations/en';
import { fr } from './translations/fr';

const dictionaries: Record<SupportedLanguage, TranslationSchema> = {
    es,
    en,
    fr,
};

export const getTranslationDictionary = (lang: SupportedLanguage): TranslationSchema => {
    return dictionaries[lang] || dictionaries.es;
};

export const useTranslation = () => {
    const { language, setLanguage } = useI18nStore();
    const t = getTranslationDictionary(language);

    return {
        t,
        language,
        setLanguage,
        languages: SUPPORTED_LANGUAGES,
    };
};

export * from './types';
export { useI18nStore };
