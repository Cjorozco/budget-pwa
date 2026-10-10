import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { seedInitialData } from '@/lib/db/seed';
import { applyFirstRunRegion, getRegion, useRegionStore } from '@/lib/region/regionStore';
import { useI18nStore } from '@/lib/i18n/i18nStore';

const clearDb = () =>
    Promise.all([db.categories.clear(), db.accounts.clear(), db.appConfig.clear(), db.quickTemplates.clear(), db.transactions.clear()]);

const setNavigatorLanguage = (language: string) => vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language);

describe('first-run link (?region=CA&lang=en)', () => {
    beforeEach(async () => {
        localStorage.clear();
        useRegionStore.setState({ country: 'CO' });
        useI18nStore.setState({ language: 'es' });
        window.history.replaceState(null, '', '/');
        await clearDb();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        window.history.replaceState(null, '', '/');
        useRegionStore.setState({ country: 'CO' });
        useI18nStore.setState({ language: 'es' });
    });

    it('sets region and language from the query', () => {
        applyFirstRunRegion('?region=CA&lang=fr');
        expect(getRegion()).toEqual({ country: 'CA', currency: 'CAD' });
        expect(useI18nStore.getState().language).toBe('fr');
    });

    it('is case-insensitive and accepts every supported country and language', () => {
        applyFirstRunRegion('?region=us&lang=EN');
        expect(getRegion().country).toBe('US');
        expect(useI18nStore.getState().language).toBe('en');
    });

    it('ignores invalid values and falls back to the browser locale', () => {
        setNavigatorLanguage('en-US');
        applyFirstRunRegion('?region=MX&lang=de');
        expect(getRegion().country).toBe('CO');
        expect(useI18nStore.getState().language).toBe('es');
    });

    it('a language alone keeps the locale-based region', () => {
        setNavigatorLanguage('en-CA');
        applyFirstRunRegion('?lang=fr');
        expect(getRegion().country).toBe('CA');
        expect(useI18nStore.getState().language).toBe('fr');
    });

    it('wins over a region stored earlier (the database is empty when this runs)', () => {
        useRegionStore.getState().setCountry('CO');
        applyFirstRunRegion('?region=CA');
        expect(getRegion().country).toBe('CA');
    });

    it('removes only its own parameters from the address bar', () => {
        window.history.replaceState(null, '', '/settings?region=CA&lang=en&utm=test#top');
        applyFirstRunRegion();
        expect(window.location.pathname).toBe('/settings');
        expect(window.location.search).toBe('?utm=test');
        expect(window.location.hash).toBe('#top');
    });

    it('leaves the address bar alone when there is nothing to apply', () => {
        window.history.replaceState(null, '', '/?foo=1');
        applyFirstRunRegion();
        expect(window.location.search).toBe('?foo=1');
    });

    describe('with the seed', () => {
        it('a Canadian link on an en-US browser seeds a Canadian setup, before anything is created', async () => {
            setNavigatorLanguage('en-US');
            window.history.replaceState(null, '', '/?region=CA&lang=en');

            await seedInitialData();

            expect(getRegion().country).toBe('CA');
            const accounts = await db.accounts.toArray();
            expect(accounts.map((a) => a.name).sort()).toEqual(['Bank', 'Cash']);
            expect(accounts.every((a) => a.currency === 'CAD')).toBe(true);
            const groceries = await db.categories.filter((c) => c.seedKey === 'Gastos diarios › Supermercado').first();
            expect(groceries?.name).toBe('Groceries');
            expect(window.location.search).toBe('');
        });

        it('is ignored when there is already data: it never relabels a real database', async () => {
            await db.accounts.add({ id: 'a', name: 'Mi cuenta', type: 'bank', calculatedBalance: 100, currency: 'COP', isActive: true });
            window.history.replaceState(null, '', '/?region=CA&lang=en');

            await seedInitialData();

            expect(getRegion().country).toBe('CO');
            expect(useI18nStore.getState().language).toBe('es');
            expect((await db.accounts.get('a'))?.currency).toBe('COP');
        });

        it('React StrictMode runs the seed twice: the second run changes nothing', async () => {
            window.history.replaceState(null, '', '/?region=CA&lang=fr');

            await Promise.all([seedInitialData(), seedInitialData()]);

            expect(getRegion().country).toBe('CA');
            expect(useI18nStore.getState().language).toBe('fr');
            expect(await db.accounts.count()).toBe(2);
            expect(await db.quickTemplates.count()).toBe(3);
        });
    });
});
