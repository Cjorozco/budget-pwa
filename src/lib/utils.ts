import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
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
