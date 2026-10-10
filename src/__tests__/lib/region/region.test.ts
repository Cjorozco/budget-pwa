import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    COUNTRIES,
    CURRENCY_BY_COUNTRY,
    countryForCurrency,
    currencyDigits,
    inferCountryFromLocale,
    isCountryCode,
    languageForCanadianLocale,
    numberLocale,
    regionFor,
} from '@/lib/region/region';
import { getRegion, hasStoredRegion, initRegionFromLocale, useRegionStore } from '@/lib/region/regionStore';
import { useI18nStore } from '@/lib/i18n/i18nStore';
import { getNumberSeparators, roundMoney } from '@/lib/money';

describe('region model', () => {
    it('maps each country to exactly one currency', () => {
        expect(CURRENCY_BY_COUNTRY).toEqual({ CO: 'COP', CA: 'CAD', US: 'USD' });
        for (const country of COUNTRIES) {
            expect(countryForCurrency(regionFor(country).currency)).toBe(country);
        }
    });

    it('recognizes valid country codes only', () => {
        expect(isCountryCode('CA')).toBe(true);
        expect(isCountryCode('MX')).toBe(false);
        expect(isCountryCode(undefined)).toBe(false);
    });

    it('guesses Canada only from a -CA locale and never guesses the United States', () => {
        expect(inferCountryFromLocale('en-CA')).toBe('CA');
        expect(inferCountryFromLocale('fr-CA')).toBe('CA');
        expect(inferCountryFromLocale('en-US')).toBe('CO');
        expect(inferCountryFromLocale('es-US')).toBe('CO');
        expect(inferCountryFromLocale('es-CO')).toBe('CO');
        expect(inferCountryFromLocale('en')).toBe('CO');
        expect(inferCountryFromLocale(undefined)).toBe('CO');
    });

    it('derives the UI language from a Canadian locale tag', () => {
        expect(languageForCanadianLocale('fr-CA')).toBe('fr');
        expect(languageForCanadianLocale('en-CA')).toBe('en');
        expect(languageForCanadianLocale('de-CA')).toBeNull();
        expect(languageForCanadianLocale(undefined)).toBeNull();
    });

    it('keeps Colombia on es-CO whatever the UI language, and lets Canada follow it', () => {
        expect(numberLocale('CO', 'es')).toBe('es-CO');
        expect(numberLocale('CO', 'en')).toBe('es-CO');
        expect(numberLocale('CO', 'fr')).toBe('es-CO');
        expect(numberLocale('CA', 'en')).toBe('en-CA');
        expect(numberLocale('CA', 'fr')).toBe('fr-CA');
        expect(numberLocale('CA', 'es')).toBe('en-CA');
        expect(numberLocale('US', 'es')).toBe('en-US');
    });

    it('uses cents for CAD and USD but not for pesos', () => {
        expect(currencyDigits('COP')).toBe(0);
        expect(currencyDigits('CAD')).toBe(2);
        expect(currencyDigits('USD')).toBe(2);
    });
});

describe('money helpers', () => {
    it('roundMoney removes floating point noise and keeps whole pesos intact', () => {
        expect(0.1 + 0.2).not.toBe(0.3);
        expect(roundMoney(0.1 + 0.2)).toBe(0.3);
        expect(roundMoney(1.005)).toBe(1.01);
        expect(roundMoney(-0.1 - 0.2)).toBe(-0.3);
        expect(roundMoney(1500000)).toBe(1500000);
        expect(roundMoney(-50000)).toBe(-50000);
    });

    it('reads separators from Intl instead of hardcoding them', () => {
        expect(getNumberSeparators('es-CO')).toEqual({ group: '.', decimal: ',' });
        expect(getNumberSeparators('en-CA')).toEqual({ group: ',', decimal: '.' });
        expect(getNumberSeparators('fr-CA').decimal).toBe(',');
        expect(getNumberSeparators('fr-CA').group).toMatch(/\s/);
    });
});

describe('region store', () => {
    const setNavigatorLanguage = (language: string) =>
        vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language);

    beforeEach(() => {
        localStorage.clear();
        useRegionStore.setState({ country: 'CO' });
        useI18nStore.setState({ language: 'es' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('defaults to Colombia / COP when nothing was chosen', () => {
        expect(getRegion()).toEqual({ country: 'CO', currency: 'COP' });
        expect(hasStoredRegion()).toBe(false);
    });

    it('persists the chosen country', () => {
        useRegionStore.getState().setCountry('CA');
        expect(getRegion()).toEqual({ country: 'CA', currency: 'CAD' });
        expect(JSON.parse(localStorage.getItem('budget_region')!)).toEqual({ country: 'CA' });
        expect(hasStoredRegion()).toBe(true);
    });

    it('first run with a Canadian browser picks Canada and its language', () => {
        setNavigatorLanguage('fr-CA');
        initRegionFromLocale();
        expect(getRegion().country).toBe('CA');
        expect(useI18nStore.getState().language).toBe('fr');
    });

    it('does not override a language the user already saved', () => {
        localStorage.setItem('budget_language', 'es');
        setNavigatorLanguage('fr-CA');
        initRegionFromLocale();
        expect(getRegion().country).toBe('CA');
        expect(useI18nStore.getState().language).toBe('es');
    });

    it('first run with any other browser stays Colombia and leaves the language alone', () => {
        setNavigatorLanguage('en-US');
        initRegionFromLocale();
        expect(getRegion().country).toBe('CO');
        expect(useI18nStore.getState().language).toBe('es');
    });

    it('never changes a stored region', () => {
        useRegionStore.getState().setCountry('US');
        setNavigatorLanguage('en-CA');
        initRegionFromLocale();
        expect(getRegion().country).toBe('US');
    });
});
