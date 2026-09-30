import { create } from 'zustand';
import type { SupportedLanguage } from './types';

interface I18nState {
    language: SupportedLanguage;
    setLanguage: (language: SupportedLanguage) => void;
}

const STORAGE_KEY = 'budget_language';

const getInitialLanguage = (): SupportedLanguage => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const saved = window.localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
            if (saved && (saved === 'es' || saved === 'en' || saved === 'fr')) {
                return saved;
            }
        }
    } catch {
        // Fallback for SSR / test environments
    }
    return 'es';
};

export const useI18nStore = create<I18nState>((set) => ({
    language: getInitialLanguage(),
    setLanguage: (language) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(STORAGE_KEY, language);
            }
            if (typeof document !== 'undefined') {
                document.documentElement.lang = language;
            }
        } catch {
            // Ignore storage errors
        }
        set({ language });
    },
}));
