import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatCurrency, formatMoneyInput, moneyDecimalSeparator, numberToMoneyInput, parseMoneyInput } from '@/lib/utils';
import { getNumberSeparators } from '@/lib/money';
import { useRegionStore } from '@/lib/region/regionStore';
import { useI18nStore } from '@/lib/i18n/i18nStore';

const setRegion = (country: 'CO' | 'CA' | 'US', language: 'es' | 'en' | 'fr' = 'es') => {
    useRegionStore.setState({ country });
    useI18nStore.setState({ language });
};

describe('formatCurrency / money input by region', () => {
    beforeEach(() => setRegion('CO'));
    afterEach(() => {
        localStorage.clear();
        setRegion('CO');
    });

    describe('Colombia (the behaviour the app always had)', () => {
        it('writes pesos exactly like the previous es-CO / COP formatter, in any UI language', () => {
            const legacy = (n: number) =>
                new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

            for (const language of ['es', 'en', 'fr'] as const) {
                setRegion('CO', language);
                for (const amount of [0, 500, 1234.56, 1500000, -50000]) {
                    expect(formatCurrency(amount)).toBe(legacy(amount));
                }
            }
        });

        it('keeps the es-CO typing format', () => {
            expect(formatMoneyInput('1234567')).toBe('1.234.567');
            expect(formatMoneyInput('1234,5678')).toBe('1.234,56');
            expect(parseMoneyInput('1.234,50')).toBe(1234.5);
            expect(numberToMoneyInput(1234.5)).toBe('1.234,5');
            expect(moneyDecimalSeparator()).toBe(',');
        });
    });

    describe('Canada, English', () => {
        beforeEach(() => setRegion('CA', 'en'));

        it('shows dollars with cents and en-CA separators', () => {
            expect(formatCurrency(1234.5)).toBe('$1,234.50');
            expect(formatCurrency(0.05)).toBe('$0.05');
            expect(formatCurrency(-12.3)).toBe('-$12.30');
        });

        it('types with comma for thousands and point for decimals', () => {
            expect(formatMoneyInput('1234567')).toBe('1,234,567');
            expect(formatMoneyInput('1234567.891')).toBe('1,234,567.89');
            expect(formatMoneyInput('.5')).toBe('0.5');
            expect(parseMoneyInput('1,234.50')).toBe(1234.5);
            expect(numberToMoneyInput(1234.5)).toBe('1,234.5');
            expect(moneyDecimalSeparator()).toBe('.');
        });

        it('round-trips what it writes', () => {
            for (const value of [0, 7, 1234.5, 99999.99, 1234567.1]) {
                expect(parseMoneyInput(numberToMoneyInput(value))).toBe(value);
            }
        });
    });

    describe('Canada, French', () => {
        beforeEach(() => setRegion('CA', 'fr'));

        it('writes the decimal with a comma and groups with a space', () => {
            const { group } = getNumberSeparators('fr-CA');
            expect(formatMoneyInput('1234567,891')).toBe(`1${group}234${group}567,89`);
            expect(parseMoneyInput(`1${group}234,50`)).toBe(1234.5);
            expect(formatCurrency(1234.5)).toContain('1');
            expect(formatCurrency(1234.5)).toContain(',50');
            expect(formatCurrency(1234.5)).toContain('$');
        });
    });

    describe('United States', () => {
        it('shows USD with en-US separators', () => {
            setRegion('US', 'es');
            expect(formatCurrency(1234.5)).toBe('$1,234.50');
            expect(formatMoneyInput('1234.567')).toBe('1,234.56');
        });
    });

    it('formats an explicit currency regardless of the region', () => {
        setRegion('CO');
        expect(formatCurrency(1000, 'USD')).toContain('1.000,00');
        setRegion('CA', 'en');
        expect(formatCurrency(1000, 'COP')).toContain('1,000');
        expect(formatCurrency(1000, 'COP')).not.toContain('.00');
    });
});
