/**
 * Money arithmetic. Amounts are plain numbers, so sums of cents (0.1 + 0.2) drift in floating
 * point. Balances must stay exact and reconciliation compares them with ===, so every balance
 * that is computed goes through roundMoney(). For whole-peso amounts it is the identity.
 */
export function roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Whole number of minor units (pesos for COP, cents for CAD/USD). Rounds through Intl so an
 * exported figure always equals what formatCurrency() shows for the same amount.
 */
export function toMinorUnits(amount: number, digits: 0 | 2): number {
    const text = new Intl.NumberFormat('en-US', {
        useGrouping: false,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(amount);
    return Number(text.replace('.', '')) || 0;
}

export interface NumberSeparators {
    group: string;
    decimal: string;
}

const separatorCache = new Map<string, NumberSeparators>();

/** Group and decimal separators of a locale, taken from Intl so they are never hardcoded. */
export function getNumberSeparators(locale: string): NumberSeparators {
    const cached = separatorCache.get(locale);
    if (cached) return cached;

    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.89);
    const separators: NumberSeparators = {
        group: parts.find((p) => p.type === 'group')?.value ?? ',',
        decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    };
    separatorCache.set(locale, separators);
    return separators;
}
