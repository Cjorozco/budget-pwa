import type { SupportedLanguage } from '@/lib/i18n/types';

/**
 * Region = where the user lives. It decides the currency and how numbers are written.
 * One country maps to exactly one currency; every account of the app uses that currency
 * (balances are summed, so mixing currencies would give wrong totals).
 */
export const COUNTRIES = ['CO', 'CA', 'US'] as const;
export type CountryCode = (typeof COUNTRIES)[number];

export const CURRENCIES = ['COP', 'CAD', 'USD'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_BY_COUNTRY: Record<CountryCode, CurrencyCode> = {
    CO: 'COP',
    CA: 'CAD',
    US: 'USD',
};

/** Default for anyone who never chose: the behaviour the app always had. */
export const DEFAULT_COUNTRY: CountryCode = 'CO';

export interface Region {
    country: CountryCode;
    currency: CurrencyCode;
}

export function isCountryCode(value: unknown): value is CountryCode {
    return typeof value === 'string' && (COUNTRIES as readonly string[]).includes(value);
}

export function regionFor(country: CountryCode): Region {
    return { country, currency: CURRENCY_BY_COUNTRY[country] };
}

export function countryForCurrency(currency: CurrencyCode): CountryCode {
    return COUNTRIES.find((c) => CURRENCY_BY_COUNTRY[c] === currency) ?? DEFAULT_COUNTRY;
}

/**
 * First-run guess from the browser locale: "en-CA" / "fr-CA" -> Canada, anything else -> Colombia.
 * The United States is never guessed (an English browser says little about where someone lives);
 * it is chosen in Settings.
 */
export function inferCountryFromLocale(tag: string | undefined | null): CountryCode {
    const subtag = tag?.split('-')[1]?.toUpperCase();
    return subtag === 'CA' ? 'CA' : DEFAULT_COUNTRY;
}

/** UI language implied by a Canadian locale tag; null when it should stay as it is. */
export function languageForCanadianLocale(tag: string | undefined | null): SupportedLanguage | null {
    const lang = tag?.split('-')[0]?.toLowerCase();
    return lang === 'fr' ? 'fr' : lang === 'en' ? 'en' : null;
}

/**
 * Locale used to write numbers. Colombia keeps es-CO whatever the UI language is (the app's
 * historical format); Canada follows the UI language (en-CA or fr-CA).
 */
export function numberLocale(country: CountryCode, uiLanguage: SupportedLanguage): string {
    switch (country) {
        case 'CA':
            return uiLanguage === 'fr' ? 'fr-CA' : 'en-CA';
        case 'US':
            return 'en-US';
        case 'CO':
        default:
            return 'es-CO';
    }
}

/** Colombian pesos have no cents in practice; CAD and USD do. */
export function currencyDigits(currency: CurrencyCode): 0 | 2 {
    return currency === 'COP' ? 0 : 2;
}
