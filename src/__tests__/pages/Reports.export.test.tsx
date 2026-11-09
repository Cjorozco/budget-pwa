import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import Reports from '@/pages/Reports';
import { db } from '@/lib/db';
import { loadMonthlyHistory } from '@/lib/reports/monthlyHistory';
import { toHistoryJson } from '@/lib/reports/monthlyHistoryFormat';
import { useUIStore } from '@/store/ui';
import { formatCurrency as format } from '@/lib/utils';
import { accounts, categories, labels, makeBudgetItem, makeTx, reserves, ts } from '../lib/reports/fixtures';

const NOW = new Date(2026, 10, 15, 10, 30);

/** Testing Library collapses the non-breaking space that Intl puts after the currency symbol. */
const formatCurrency = (amount: number) => format(amount).replaceAll(String.fromCharCode(160), ' ');

async function clearAll() {
    await Promise.all([
        db.transactions.clear(),
        db.categories.clear(),
        db.budgetItems.clear(),
        db.accounts.clear(),
        db.reserves.clear(),
    ]);
}

async function seed() {
    await db.categories.bulkAdd(categories);
    await db.accounts.bulkAdd(accounts);
    await db.reserves.bulkAdd(reserves);
    await db.budgetItems.bulkAdd([
        makeBudgetItem({ type: 'expense', amount: 800000, month: '2026-11', name: 'Gasto fijo A' }),
        makeBudgetItem({ type: 'income', amount: 2500000, month: '2026-11', name: 'Ingreso fijo' }),
    ]);
    await db.transactions.bulkAdd([
        makeTx({ type: 'income', amount: 2345678, date: ts(2026, 11, 2), categoryId: 'cat-inc-1' }),
        makeTx({ type: 'expense', amount: 654321, date: ts(2026, 11, 3), categoryId: 'cat-1a' }),
        makeTx({ type: 'expense', amount: 111111, date: ts(2026, 11, 4), categoryId: 'cat-2' }),
        makeTx({ type: 'expense', amount: 22222, date: ts(2026, 11, 5), categoryId: 'cat-adj', isAdjustment: true }),
        makeTx({ type: 'transfer', amount: 500000, date: ts(2026, 11, 6), categoryId: 'transfer-out' }),
        makeTx({ type: 'expense', amount: 999999, date: ts(2026, 10, 6), categoryId: 'cat-2' }),
    ]);
}

const renderPage = (page: React.ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    useUIStore.setState({ toasts: [] });
    await clearAll();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('exported figures match the screens for the same month', () => {
    const currentMonth = async () => {
        const history = await loadMonthlyHistory({ selectedMonth: NOW, range: 'month', labels });
        return JSON.parse(toHistoryJson(history));
    };

    beforeEach(seed);

    it('matches the Dashboard income, expense, net and available balance', async () => {
        const json = await currentMonth();
        const [month] = json.months;

        expect(month.totals).toEqual({ income: 2345678, expense: 787654, net: 1558024 });
        expect(json.balanceAtExport).toEqual({ total: 1500000, reserved: 400000, available: 1100000 });

        renderPage(<Dashboard />);

        await waitFor(() => expect(screen.getByText(formatCurrency(month.totals.income))).toBeInTheDocument());
        expect(screen.getByText(formatCurrency(month.totals.expense))).toBeInTheDocument();
        expect(screen.getByText(`+${formatCurrency(month.totals.net)}`)).toBeInTheDocument();
        expect(await screen.findByText(formatCurrency(json.balanceAtExport.available))).toBeInTheDocument();
    });

    it('matches the Reports totals, categories and fixed budget', async () => {
        const json = await currentMonth();
        const [month] = json.months;

        renderPage(<Reports />);

        await waitFor(() => expect(screen.getAllByText(formatCurrency(month.totals.expense)).length).toBeGreaterThan(0));
        for (const category of month.expenses.byCategory) {
            expect(screen.getAllByText(formatCurrency(category.amount)).length).toBeGreaterThan(0);
        }

        fireEvent.click(screen.getByRole('button', { name: /Presupuesto Fijo/i }));

        await waitFor(() => {
            expect(screen.getByText(`Dentro del presupuesto (${month.fixedBudget.expenseUsedPercent}%)`)).toBeInTheDocument();
        });
        expect(month.fixedBudget.expenseUsedPercent).toBe(98);
        expect(screen.getAllByText(formatCurrency(month.fixedBudget.plannedExpense)).length).toBeGreaterThan(0);
        expect(screen.getAllByText(formatCurrency(month.fixedBudget.plannedIncome)).length).toBeGreaterThan(0);
    });
});

describe('export action in Reports', () => {
    const downloads: Array<{ name: string; blob: Blob }> = [];
    let lastBlob: Blob;

    beforeEach(() => {
        downloads.length = 0;
        URL.createObjectURL = vi.fn((blob: Blob) => {
            lastBlob = blob;
            return 'blob:test';
        }) as typeof URL.createObjectURL;
        URL.revokeObjectURL = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            downloads.push({ name: this.download, blob: lastBlob });
        });
    });

    const openModal = async () => {
        renderPage(<Reports />);
        fireEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
        return within(await screen.findByRole('dialog'));
    };

    it('offers 12 months by default and downloads JSON named only with months', async () => {
        await seed();
        const dialog = await openModal();

        expect(dialog.getByRole('radio', { name: '12 meses' })).toBeChecked();

        const button = dialog.getByRole('button', { name: 'Descargar JSON' });
        await waitFor(() => expect(button).toBeEnabled());
        fireEvent.click(button);

        expect(downloads).toHaveLength(1);
        expect(downloads[0].name).toBe('historial-2026-10_2026-11.json');
        expect(downloads[0].blob.type).toBe('application/json');
        expect(useUIStore.getState().toasts.at(-1)).toMatchObject({ message: 'Historial descargado', type: 'success' });
    });

    it('downloads Markdown for the chosen range', async () => {
        await seed();
        const dialog = await openModal();

        fireEvent.click(dialog.getByRole('radio', { name: 'Solo este mes' }));

        const button = dialog.getByRole('button', { name: 'Descargar Markdown' });
        await waitFor(() => expect(button).toBeEnabled());
        fireEvent.click(button);

        expect(downloads.at(-1)?.name).toBe('historial-2026-11.md');
        expect(downloads.at(-1)?.blob.type).toBe('text/markdown;charset=utf-8');
    });

    it('disables both downloads and explains why when the range has no data', async () => {
        const dialog = await openModal();

        expect(await dialog.findByText('No hay movimientos ni presupuesto en este periodo.')).toBeInTheDocument();
        expect(dialog.getByRole('button', { name: 'Descargar JSON' })).toBeDisabled();
        expect(dialog.getByRole('button', { name: 'Descargar Markdown' })).toBeDisabled();
    });

    it('reports a failed download with a toast and no console output', async () => {
        await seed();
        (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
            throw new Error('fallo');
        });
        const consoleSpies = (['log', 'info', 'debug', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m));
        const dialog = await openModal();

        const button = dialog.getByRole('button', { name: 'Descargar JSON' });
        await waitFor(() => expect(button).toBeEnabled());
        fireEvent.click(button);

        expect(useUIStore.getState().toasts.at(-1)).toMatchObject({ message: 'No se pudo exportar el historial', type: 'error' });
        consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    });
});
