import { afterEach, describe, expect, it } from 'vitest';
import { es as dateLocale } from 'date-fns/locale';
import { getTranslationDictionary } from '@/lib/i18n';
import { useRegionStore } from '@/lib/region/regionStore';
import { buildMonthlyHistory, type BuildHistoryInput } from '@/lib/reports/monthlyHistory';
import { toHistoryJson, toHistoryMarkdown } from '@/lib/reports/monthlyHistoryFormat';
import { formatCurrency } from '@/lib/utils';
import { accounts, categories, labels, makeBudgetItem, makeTx, reserves, ts } from './fixtures';

const NOW = new Date(2026, 10, 9, 10, 30);

function build(overrides: Partial<BuildHistoryInput> = {}) {
    return buildMonthlyHistory({
        selectedMonth: NOW,
        range: '12',
        transactions: [
            makeTx({ type: 'income', amount: 3000000, date: ts(2026, 9, 1), categoryId: 'cat-inc-1' }),
            makeTx({ type: 'expense', amount: 1234567, date: ts(2026, 9, 5), categoryId: 'cat-1a' }),
            makeTx({ type: 'income', amount: 3200000, date: ts(2026, 10, 1), categoryId: 'cat-inc-1' }),
            makeTx({ type: 'expense', amount: 1500000, date: ts(2026, 10, 5), categoryId: 'cat-2' }),
            makeTx({ type: 'expense', amount: 20000, date: ts(2026, 10, 6), categoryId: 'cat-adj', isAdjustment: true }),
            makeTx({ type: 'expense', amount: 90000, date: ts(2026, 11, 2), categoryId: 'cat-1b' }),
        ],
        categories,
        budgetItems: [
            makeBudgetItem({ type: 'expense', amount: 100000, name: 'Gasto fijo menor', month: '2026-10' }),
            makeBudgetItem({ type: 'expense', amount: 900000, name: 'Gasto fijo mayor', month: '2026-10', categoryId: 'cat-2' }),
        ],
        accounts,
        reserves,
        now: NOW,
        labels,
        currency: 'COP',
        ...overrides,
    });
}

const parse = (history: ReturnType<typeof build>) => JSON.parse(toHistoryJson(history));

function collectNumbers(value: unknown, path = '', out: Array<[string, number]> = []) {
    if (typeof value === 'number') out.push([path, value]);
    else if (Array.isArray(value)) value.forEach((v, i) => collectNumbers(v, `${path}[${i}]`, out));
    else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => collectNumbers(v, `${path}.${k}`, out));
    }
    return out;
}

describe('toHistoryJson', () => {
    it('writes top-level fields in the agreed order', () => {
        expect(Object.keys(parse(build()))).toEqual([
            'schemaVersion',
            'range',
            'generatedAt',
            'currency',
            'balanceAtExport',
            'summary',
            'months',
            'transactions',
        ]);
    });

    it('writes each month with the agreed fields', () => {
        expect(Object.keys(parse(build()).months[0])).toEqual([
            'month',
            'isPartial',
            'daysElapsed',
            'daysInMonth',
            'hasData',
            'totals',
            'adjustments',
            'fixedBudget',
            'expenses',
            'income',
            'dataQuality',
        ]);
    });

    it('uses only integers for every number, even with fractional amounts', () => {
        const history = build({
            transactions: [
                makeTx({ type: 'expense', amount: 1000.5, date: ts(2026, 9, 5) }),
                makeTx({ type: 'expense', amount: 333.33, date: ts(2026, 10, 5), categoryId: 'cat-2' }),
                makeTx({ type: 'income', amount: 777.77, date: ts(2026, 10, 7), categoryId: 'cat-inc' }),
            ],
        });
        const notIntegers = collectNumbers(parse(history)).filter(([, n]) => !Number.isInteger(n));
        expect(notIntegers).toEqual([]);
    });

    it('writes cents and declares them for a currency with decimals', () => {
        const history = build({
            currency: 'CAD',
            transactions: [makeTx({ type: 'expense', amount: 12.34, date: ts(2026, 10, 5) })],
        });
        const json = parse(history);
        expect(json.currency).toEqual({ code: 'CAD', minorUnitDigits: 2 });
        expect(json.months[0].totals.expense).toBe(1234);
    });

    it('rounds the net from the raw figures, as the Dashboard shows it', () => {
        const history = build({
            transactions: [
                makeTx({ type: 'income', amount: 100.4, date: ts(2026, 10, 1), categoryId: 'cat-inc' }),
                makeTx({ type: 'expense', amount: 50.3, date: ts(2026, 10, 2) }),
            ],
        });
        expect(parse(history).months[0].totals.net).toBe(50);
    });

    it('lists fixed items from the largest down with their category link', () => {
        const october = parse(build()).months[1];
        expect(october.fixedBudget.expenseItems).toEqual([
            { name: 'Gasto fijo mayor', amount: 900000, categoryId: 'cat-2' },
            { name: 'Gasto fijo menor', amount: 100000, categoryId: null },
        ]);
    });

    it('does not expose descriptions, account names or colors', () => {
        const text = toHistoryJson(build({
            transactions: [makeTx({ type: 'expense', amount: 5, date: ts(2026, 10, 5), description: 'TEXTO-CENTINELA' })],
        }));
        expect(text).not.toContain('TEXTO-CENTINELA');
        expect(text).not.toContain('Cuenta A');
        expect(text).not.toContain('color');
    });

    it('stores the summary as null when there are no complete months', () => {
        const json = parse(build({ range: 'month' }));
        expect(json.summary).toEqual({ income: null, expense: null, expenseByCategory: [] });
    });
});

describe('toHistoryMarkdown', () => {
    afterEach(() => useRegionStore.setState({ country: 'CO' }));

    const render = (history: ReturnType<typeof build>) =>
        toHistoryMarkdown(history, {
            labels: getTranslationDictionary('es').reports.historyExport,
            formatMoney: formatCurrency,
            dateLocale,
        }).replaceAll(String.fromCharCode(160), ' ');

    it('writes a title with the period and the currency', () => {
        const md = render(build());
        expect(md.split('\n')[0]).toBe('# Historial financiero: septiembre 2026 a noviembre 2026');
        expect(md).toContain('Generado el 9 de noviembre de 2026 · Moneda: COP');
    });

    it('formats Colombian pesos with dots and no decimals', () => {
        expect(render(build())).toContain('| septiembre 2026 | $ 3.000.000 | $ 1.234.567 | $ 1.765.433 | $ 0 |');
    });

    it('follows the region for other currencies', () => {
        useRegionStore.setState({ country: 'CA' });
        const history = build({
            currency: 'CAD',
            transactions: [makeTx({ type: 'expense', amount: 1234.5, date: ts(2026, 10, 5) })],
        });
        expect(render(history)).toContain('$1,234.50');
    });

    it('labels partial months', () => {
        expect(render(build())).toContain('| noviembre 2026 (parcial) |');
    });

    it('labels months without data', () => {
        const history = build({
            transactions: [
                makeTx({ type: 'expense', amount: 1, date: ts(2026, 8, 5) }),
                makeTx({ type: 'expense', amount: 1, date: ts(2026, 10, 5) }),
            ],
            budgetItems: [],
        });
        expect(render(history)).toContain('| septiembre 2026 (sin datos) |');
    });

    it('shows the statistics of each category', () => {
        expect(render(build())).toContain('| Categoría 2 | $ 750.000 | $ 750.000 | $ 0 | $ 1.500.000 | 1 |');
    });

    it('explains that there are no complete months yet', () => {
        expect(render(build({ range: 'month' }))).toContain('Aún no hay meses completos');
    });

    it('breaks down categories when the range is a single month', () => {
        const md = render(build({ range: 'month', selectedMonth: new Date(2026, 9, 1) }));
        expect(md).toContain('| Categoría 2 | $ 1.500.000 | 99% |');
    });

    it('states the balance snapshot, adjustments and partial month in the notes', () => {
        const md = render(build());
        expect(md).toContain('| Disponible | $ 1.100.000 |');
        expect(md).toContain('$ 20.000');
        expect(md).toMatch(/foto del momento/);
        expect(md).toMatch(/no entra en los promedios/);
    });

    it('warns about demo data only when there is some', () => {
        expect(render(build())).not.toContain('demostración');
        const demo = makeTx({ id: 'demo-9', type: 'expense', amount: 1, date: ts(2026, 10, 5) });
        expect(render(build({ transactions: [demo] }))).toContain('demostración');
    });

    it('escapes pipes and line breaks in category names', () => {
        const tricky = categories.map((c) => (c.id === 'cat-2' ? { ...c, name: 'A|B\nC' } : c));
        const history = build({
            categories: tricky,
            transactions: [makeTx({ type: 'expense', amount: 10, date: ts(2026, 10, 5), categoryId: 'cat-2' })],
        });
        expect(render(history)).toContain('| A\\|B C |');
    });

    it('does not write individual movements', () => {
        const md = render(build({
            transactions: [makeTx({ type: 'expense', amount: 5, date: ts(2026, 10, 5), description: 'TEXTO-CENTINELA' })],
        }));
        expect(md).not.toContain('TEXTO-CENTINELA');
    });
});
