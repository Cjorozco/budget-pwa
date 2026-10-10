import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useI18nStore } from '@/lib/i18n/i18nStore';
import { getNumberSeparators } from '@/lib/money';
import { currencyDigits, numberLocale, type CurrencyCode } from '@/lib/region/region';
import { getRegion } from '@/lib/region/regionStore';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Current timestamp in ms. Wrapped so event handlers don't trip the purity lint on `Date.now`. */
export function now() {
    return Date.now();
}

/** Picks a random element; kept out of components so render stays pure. */
export function pickRandom<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}

/** Capitaliza solo la primera letra; el resto queda en minúsculas. */
export function toSentenceCase(str: string) {
    if (!str) return str;
    const lower = str.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Locale for numbers: from the active region and the UI language (Colombia stays es-CO). */
function activeNumberLocale(): string {
    return numberLocale(getRegion().country, useI18nStore.getState().language);
}

export function formatCurrency(amount: number, currency: CurrencyCode = getRegion().currency) {
    const digits = currencyDigits(currency);
    return new Intl.NumberFormat(activeNumberLocale(), {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(amount);
}

export function adjustColor(color: string, amount: number) {
    const clamp = (val: number) => Math.min(255, Math.max(0, val));
    return '#' + color.replace(/^#/, '').replace(/../g, c => 
        ('0' + clamp(parseInt(c, 16) + amount).toString(16)).slice(-2)
    );
}

/** Decimal separator of the active region's number format ("," in Colombia, "." in en-CA). */
export function moneyDecimalSeparator(): string {
    return getNumberSeparators(activeNumberLocale()).decimal;
}

/** Keeps only digits and the given decimal separator. */
function keepDigitsAndDecimal(text: string, decimal: string): string {
    return [...text].filter((ch) => (ch >= '0' && ch <= '9') || ch === decimal).join('');
}

/**
 * Normaliza lo que escribe el usuario al formato numérico de la región activa mientras teclea:
 * separador de miles en la parte entera y el separador decimal del locale (máx. 2 decimales).
 * Colombia: "1.234,50"; Canadá (en): "1,234.50"; Canadá (fr): "1 234,50".
 */
export function formatMoneyInput(raw: string): string {
    const { group, decimal } = getNumberSeparators(activeNumberLocale());
    const cleaned = keepDigitsAndDecimal(raw, decimal);
    const decimalIdx = cleaned.indexOf(decimal);
    const intRaw = (decimalIdx === -1 ? cleaned : cleaned.slice(0, decimalIdx)).replace(/^0+(?=\d)/, '');
    const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, group);
    if (decimalIdx === -1) return grouped;
    const decimals = cleaned.slice(decimalIdx + decimal.length).split(decimal).join('').slice(0, 2);
    return `${grouped || '0'}${decimal}${decimals}`;
}

/** Convierte el texto mostrado ("1.234,50" en Colombia, "1,234.50" en en-CA) a número; undefined si está vacío. */
export function parseMoneyInput(display: string): number | undefined {
    if (!display.trim()) return undefined;
    const { decimal } = getNumberSeparators(activeNumberLocale());
    const n = Number(keepDigitsAndDecimal(display, decimal).replace(decimal, '.'));
    return Number.isFinite(n) ? n : undefined;
}

/** Número → texto editable en el formato de la región activa (sin símbolo de moneda). */
export function numberToMoneyInput(value: number | undefined | null): string {
    if (value === undefined || value === null || Number.isNaN(value)) return '';
    const { decimal } = getNumberSeparators(activeNumberLocale());
    return formatMoneyInput(String(value).replace('.', decimal));
}
