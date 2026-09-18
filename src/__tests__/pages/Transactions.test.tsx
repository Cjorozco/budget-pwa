import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TransactionsPage from '@/pages/Transactions';
import { db } from '@/lib/db';
import { useUIStore } from '@/store/ui';

describe('TransactionsPage Filter', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        useUIStore.setState({ toasts: [] });

        await db.transactions.clear();
        await db.accounts.clear();
        await db.categories.clear();

        await db.accounts.add({
            id: 'acc-1',
            name: 'Bancolombia',
            type: 'bank',
            calculatedBalance: 500000,
            currency: 'COP',
            isActive: true,
        });

        await db.categories.add({
            id: 'cat-exp',
            name: 'Restaurantes',
            type: 'expense',
            color: '#ef4444',
            usageCount: 1,
            isActive: true,
        });

        await db.categories.add({
            id: 'cat-inc',
            name: 'Salario Nómina',
            type: 'income',
            color: '#10b981',
            usageCount: 1,
            isActive: true,
        });

        await db.transactions.add({
            id: 'tx-1',
            amount: 45000,
            type: 'expense',
            description: 'Almuerzo en Crepes',
            accountId: 'acc-1',
            categoryId: 'cat-exp',
            date: Date.now() - 10000,
            tagIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        await db.transactions.add({
            id: 'tx-2',
            amount: 2500000,
            type: 'income',
            description: 'Pago de nómina quincenal',
            accountId: 'acc-1',
            categoryId: 'cat-inc',
            date: Date.now(),
            tagIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    });

    it('renders all transactions by default', async () => {
        render(<TransactionsPage />);

        await waitFor(() => {
            expect(screen.getByText('Almuerzo en Crepes')).toBeInTheDocument();
            expect(screen.getByText('Pago de nómina quincenal')).toBeInTheDocument();
        });
    });

    it('filters only income transactions when Ingresos filter is selected', async () => {
        render(<TransactionsPage />);

        await waitFor(() => {
            expect(screen.getByText('Almuerzo en Crepes')).toBeInTheDocument();
        });

        const incomeBtn = screen.getByTestId('filter-income');
        fireEvent.click(incomeBtn);

        await waitFor(() => {
            expect(screen.getByText('Pago de nómina quincenal')).toBeInTheDocument();
            expect(screen.queryByText('Almuerzo en Crepes')).not.toBeInTheDocument();
        });
    });

    it('filters only expense transactions when Gastos filter is selected', async () => {
        render(<TransactionsPage />);

        await waitFor(() => {
            expect(screen.getByText('Pago de nómina quincenal')).toBeInTheDocument();
        });

        const expenseBtn = screen.getByTestId('filter-expense');
        fireEvent.click(expenseBtn);

        await waitFor(() => {
            expect(screen.getByText('Almuerzo en Crepes')).toBeInTheDocument();
            expect(screen.queryByText('Pago de nómina quincenal')).not.toBeInTheDocument();
        });
    });

    it('shows empty message when no items match selected filter', async () => {
        await db.transactions.where('type').equals('income').delete();

        render(<TransactionsPage />);

        await waitFor(() => {
            expect(screen.getByText('Almuerzo en Crepes')).toBeInTheDocument();
        });

        const incomeBtn = screen.getByTestId('filter-income');
        fireEvent.click(incomeBtn);

        await waitFor(() => {
            expect(screen.getByText(/No hay ingresos registrados en/i)).toBeInTheDocument();
        });
    });

    it('navigates across months and filters transactions accordingly', async () => {
        const prevMonthDate = new Date();
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);

        await db.transactions.add({
            id: 'tx-old',
            amount: 80000,
            type: 'expense',
            description: 'Factura gas mes pasado',
            accountId: 'acc-1',
            categoryId: 'cat-exp',
            date: prevMonthDate.getTime(),
            tagIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        render(<TransactionsPage />);

        // In current month, only current month txs appear
        await waitFor(() => {
            expect(screen.getByText('Almuerzo en Crepes')).toBeInTheDocument();
            expect(screen.queryByText('Factura gas mes pasado')).not.toBeInTheDocument();
        });

        // Navigate to previous month
        const prevBtn = screen.getByTestId('prev-month-button');
        fireEvent.click(prevBtn);

        await waitFor(() => {
            expect(screen.getByText('Factura gas mes pasado')).toBeInTheDocument();
            expect(screen.queryByText('Almuerzo en Crepes')).not.toBeInTheDocument();
            expect(screen.getByTestId('go-current-month-button')).toBeInTheDocument();
        });

        // Click "Ir al actual"
        fireEvent.click(screen.getByTestId('go-current-month-button'));

        await waitFor(() => {
            expect(screen.getByText('Almuerzo en Crepes')).toBeInTheDocument();
            expect(screen.queryByText('Factura gas mes pasado')).not.toBeInTheDocument();
        });
    });
});

