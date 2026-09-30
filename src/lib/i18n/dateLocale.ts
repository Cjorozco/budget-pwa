import { es, enUS, fr } from 'date-fns/locale';
import type { SupportedLanguage } from './types';

export const getDateFnsLocale = (lang: SupportedLanguage) => {
    switch (lang) {
        case 'en':
            return enUS;
        case 'fr':
            return fr;
        case 'es':
        default:
            return es;
    }
};
