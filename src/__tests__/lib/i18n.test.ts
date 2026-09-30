import { describe, expect, it, beforeEach } from 'vitest';
import { useI18nStore } from '@/lib/i18n/i18nStore';
import { getTranslationDictionary, SUPPORTED_LANGUAGES } from '@/lib/i18n';

describe('i18n Internationalization System', () => {
    beforeEach(() => {
        useI18nStore.setState({ language: 'es' });
        localStorage.clear();
    });

    it('provides complete schemas for all supported languages (es, en, fr)', () => {
        expect(SUPPORTED_LANGUAGES).toHaveLength(3);
        const codes = SUPPORTED_LANGUAGES.map(l => l.code);
        expect(codes).toContain('es');
        expect(codes).toContain('en');
        expect(codes).toContain('fr');

        const esDict = getTranslationDictionary('es');
        const enDict = getTranslationDictionary('en');
        const frDict = getTranslationDictionary('fr');

        expect(esDict.nav.dashboard).toBe('Resumen');
        expect(enDict.nav.dashboard).toBe('Dashboard');
        expect(frDict.nav.dashboard).toBe('Tableau de bord');

        expect(esDict.nav.transactions).toBe('Movimientos');
        expect(enDict.nav.transactions).toBe('Activity');
        expect(frDict.nav.transactions).toBe('Opérations');
    });

    it('changes and persists language across the Zustand store and localStorage', () => {
        const store = useI18nStore.getState();
        expect(store.language).toBe('es');

        store.setLanguage('en');
        expect(useI18nStore.getState().language).toBe('en');
        expect(localStorage.getItem('budget_language')).toBe('en');

        store.setLanguage('fr');
        expect(useI18nStore.getState().language).toBe('fr');
        expect(localStorage.getItem('budget_language')).toBe('fr');
    });

    it('falls back to default Spanish if an invalid language key is queried', () => {
        // @ts-expect-error testing invalid language code fallback
        const dict = getTranslationDictionary('unknown_lang');
        expect(dict.nav.dashboard).toBe('Resumen');
    });

    it('verifies essential schema keys exist and are non-empty across all dictionaries', () => {
        for (const lang of ['es', 'en', 'fr'] as const) {
            const dict = getTranslationDictionary(lang);
            expect(dict.common.save).toBeTruthy();
            expect(dict.common.cancel).toBeTruthy();
            expect(dict.dashboard.totalBalance).toBeTruthy();
            expect(dict.transactions.newExpense).toBeTruthy();
            expect(dict.accounts.reconcile).toBeTruthy();
            expect(dict.budget.monthlyBudget).toBeTruthy();
            expect(dict.reports.parentCategories).toBeTruthy();
            expect(dict.settings.languageSection).toBeTruthy();
            expect(dict.upgradeModal.modalTitle).toBeTruthy();
        }
    });
});
