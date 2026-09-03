import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { db } from '@/lib/db';
import { useUIStore } from '@/store/ui';

describe('TransactionForm', () => {
    const mockOnSuccess = vi.fn();

    beforeEach(async () => {
        vi.clearAllMocks();
        useUIStore.setState({ isPro: false, toasts: [] });

        // Clean Dexie test tables
        await db.transactions.clear();
        await db.accounts.clear();
        await db.categories.clear();
        await db.reserves.clear();

        // Seed mock account and category
        await db.accounts.add({
            id: 'acc-1',
            name: 'Bancolombia',
            type: 'bank',
            calculatedBalance: 100000,
            currency: 'COP',
            isActive: true,
        });

        await db.categories.add({
            id: 'cat-alimentacion',
            name: 'Alimentación',
            type: 'expense',
            color: '#ef4444',
            usageCount: 0,
            isActive: true,
        });

        await db.categories.add({
            id: 'cat-salario',
            name: 'Salario',
            type: 'income',
            color: '#10b981',
            usageCount: 0,
            isActive: true,
        });
    });

    it('renders the form with default values and inputs', async () => {
        render(<TransactionForm onSuccess={mockOnSuccess} />);

        expect(screen.getByTestId('amount-input')).toBeInTheDocument();
        expect(screen.getByTestId('description-input')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Gasto/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ingreso/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Guardar transacción/i })).toBeInTheDocument();

        // Wait for live queries to populate selects
        await waitFor(() => {
            expect(screen.getByText('Bancolombia')).toBeInTheDocument();
            expect(screen.getByText('Alimentación')).toBeInTheDocument();
        });
    });

    it('creates an expense transaction successfully', async () => {
        const user = userEvent.setup();
        render(<TransactionForm onSuccess={mockOnSuccess} />);

        await waitFor(() => {
            expect(screen.getByText('Bancolombia')).toBeInTheDocument();
        });

        // Fill in form fields
        const amountInput = screen.getByTestId('amount-input');
        await user.type(amountInput, '25000');

        const descInput = screen.getByTestId('description-input');
        await user.type(descInput, 'Almuerzo ejecutivo');

        const categorySelect = screen.getByTestId('category-select');
        await user.selectOptions(categorySelect, 'cat-alimentacion');

        const accountSelect = screen.getByTestId('account-select');
        await user.selectOptions(accountSelect, 'acc-1');

        const submitBtn = screen.getByRole('button', { name: /Guardar transacción/i });
        await user.click(submitBtn);

        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        });

        // Verify Dexie persistence
        const txs = await db.transactions.toArray();
        expect(txs).toHaveLength(1);
        expect(txs[0].amount).toBe(25000);
        expect(txs[0].type).toBe('expense');
        expect(txs[0].accountId).toBe('acc-1');
        expect(txs[0].categoryId).toBe('cat-alimentacion');

        // Verify account balance updated
        const account = await db.accounts.get('acc-1');
        expect(account?.calculatedBalance).toBe(75000); // 100,000 - 25,000
    });

    it('creates an income transaction successfully', async () => {
        const user = userEvent.setup();
        render(<TransactionForm onSuccess={mockOnSuccess} />);

        await waitFor(() => {
            expect(screen.getByText('Bancolombia')).toBeInTheDocument();
        });

        // Switch to income
        const incomeBtn = screen.getByRole('button', { name: /Ingreso/i });
        await user.click(incomeBtn);

        await waitFor(() => {
            expect(screen.getByText('Salario')).toBeInTheDocument();
        });

        await user.type(screen.getByTestId('amount-input'), '500000');
        await user.type(screen.getByTestId('description-input'), 'Pago quincenal');

        const categorySelect = screen.getByTestId('category-select');
        await user.selectOptions(categorySelect, 'cat-salario');

        const accountSelect = screen.getByTestId('account-select');
        await user.selectOptions(accountSelect, 'acc-1');

        const submitBtn = screen.getByRole('button', { name: /Guardar transacción/i });
        await user.click(submitBtn);

        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        });

        const txs = await db.transactions.toArray();
        expect(txs).toHaveLength(1);
        expect(txs[0].amount).toBe(500000);
        expect(txs[0].type).toBe('income');

        const account = await db.accounts.get('acc-1');
        expect(account?.calculatedBalance).toBe(600000); // 100,000 + 500,000
    });

    it('populates initialData in edit mode and updates existing transaction', async () => {
        const user = userEvent.setup();

        const existingTx = {
            id: 'tx-existing',
            amount: 30000,
            description: 'Cena rápida',
            type: 'expense' as const,
            accountId: 'acc-1',
            categoryId: 'cat-alimentacion',
            date: Date.now(),
            tagIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await db.transactions.add(existingTx);

        render(<TransactionForm onSuccess={mockOnSuccess} initialData={existingTx} />);

        await waitFor(() => {
            expect(screen.getByTestId('amount-input')).toHaveValue(30000);
            expect(screen.getByTestId('description-input')).toHaveValue('Cena rápida');
            expect(screen.getByRole('button', { name: /Actualizar transacción/i })).toBeInTheDocument();
        });

        // Change amount
        const amountInput = screen.getByTestId('amount-input');
        await user.clear(amountInput);
        await user.type(amountInput, '40000');

        const submitBtn = screen.getByRole('button', { name: /Actualizar transacción/i });
        await user.click(submitBtn);

        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        });

        const updatedTx = await db.transactions.get('tx-existing');
        expect(updatedTx?.amount).toBe(40000);
    });
});
