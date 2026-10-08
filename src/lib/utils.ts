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
