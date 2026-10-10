import { create } from 'zustand';
import { useI18nStore } from '@/lib/i18n/i18nStore';
import {
    DEFAULT_COUNTRY,
    inferCountryFromLocale,
    languageForCanadianLocale,
    isCountryCode,
    regionFor,
    type CountryCode,
    type Region,
} from './region';

const STORAGE_KEY = 'budget_region';

function readStoredCountry(): CountryCode | null {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        const country = (parsed as { country?: unknown } | null)?.country;
        return isCountryCode(country) ? country : null;
    } catch {
        return null;
    }
}

function persistCountry(country: CountryCode): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ country }));
    } catch {
        // Storage unavailable: the choice lasts for this session only
    }
}

interface RegionState {
    country: CountryCode;
    setCountry: (country: CountryCode) => void;
}

/**
 * Active region. Kept in localStorage (read synchronously, like the UI language) so that
 * formatCurrency() works on the very first render; the currency is also mirrored in the
 * Dexie appConfig so backups carry it.
 */
export const useRegionStore = create<RegionState>((set) => ({
    country: readStoredCountry() ?? DEFAULT_COUNTRY,
    setCountry: (country) => {
        persistCountry(country);
        set({ country });
    },
}));

export function getRegion(): Region {
    return regionFor(useRegionStore.getState().country);
}

export function hasStoredRegion(): boolean {
    return readStoredCountry() !== null;
}

/**
 * First run only: picks the region from the browser locale (en-CA / fr-CA -> Canada, anything
 * else -> Colombia). For Canada it also sets the UI language, unless the user already chose one.
 * Does nothing when a region is stored, so people who upgrade keep Colombia/COP.
 */
export function initRegionFromLocale(): void {
    if (hasStoredRegion()) return;
    const locale = typeof navigator !== 'undefined' ? navigator.language : undefined;
    const country = inferCountryFromLocale(locale);
    useRegionStore.getState().setCountry(country);

    if (country === 'CA' && !hasSavedLanguage()) {
        const language = languageForCanadianLocale(locale);
        if (language) useI18nStore.getState().setLanguage(language);
    }
}

function hasSavedLanguage(): boolean {
    try {
        return localStorage.getItem('budget_language') !== null;
    } catch {
        return false;
    }
}
