import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function adjustColor(color: string, amount: number) {
    const clamp = (val: number) => Math.min(255, Math.max(0, val));
    return '#' + color.replace(/^#/, '').replace(/../g, c => 
        ('0' + clamp(parseInt(c, 16) + amount).toString(16)).slice(-2)
    );
}

/**
 * Normaliza lo que escribe el usuario a formato es-CO mientras teclea:
 * puntos de miles en la parte entera y coma decimal (máx. 2 decimales).
 */
export function formatMoneyInput(raw: string): string {
    const cleaned = raw.replace(/[^\d,]/g, '');
    const commaIdx = cleaned.indexOf(',');
    const intRaw = (commaIdx === -1 ? cleaned : cleaned.slice(0, commaIdx)).replace(/^0+(?=\d)/, '');
    const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (commaIdx === -1) return grouped;
    const decimals = cleaned.slice(commaIdx + 1).replace(/,/g, '').slice(0, 2);
    return `${grouped || '0'},${decimals}`;
}

/** Convierte el texto es-CO ("1.234,50") a número; undefined si está vacío. */
export function parseMoneyInput(display: string): number | undefined {
    if (!display.trim()) return undefined;
    const n = Number(display.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
}

/** Número → texto editable es-CO (sin símbolo de moneda). */
export function numberToMoneyInput(value: number | undefined | null): string {
    if (value === undefined || value === null || Number.isNaN(value)) return '';
    return formatMoneyInput(String(value).replace('.', ','));
}
