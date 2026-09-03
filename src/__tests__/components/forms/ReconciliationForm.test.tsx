import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReconciliationForm } from '@/components/forms/ReconciliationForm';
import { db } from '@/lib/db';
import { useUIStore } from '@/store/ui';
import type { Account } from '@/lib/types';

describe('ReconciliationForm', () => {
    const mockOnSuccess = vi.fn();
    const mockOnCancel = vi.fn();

    const mockAccount: Account = {
        id: 'acc-rec-1',
        name: 'Bancolombia Ahorros',
        type: 'bank',
        calculatedBalance: 500000,
        currency: 'COP',
        isActive: true,
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        useUIStore.setState({ toasts: [] });

        await db.accounts.clear();
        await db.reconciliations.clear();
        await db.transactions.clear();
        await db.categories.clear();

        await db.accounts.add({ ...mockAccount });
    });

    it('renders initial balances and form fields', () => {
        render(
            <ReconciliationForm
                account={mockAccount}
                onSuccess={mockOnSuccess}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByText('Saldo Calculado:')).toBeInTheDocument();
        expect(screen.getByText('Saldo Real (Banco):')).toBeInTheDocument();
        expect(screen.getByTestId('declared-balance-input')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Reconciliar$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();
    });

    it('calls onCancel when cancel button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <ReconciliationForm
                account={mockAccount}
                onSuccess={mockOnSuccess}
                onCancel={mockOnCancel}
            />
        );

        const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
        await user.click(cancelBtn);

        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('performs reconciliation with adjustment transaction when difference exists', async () => {
        const user = userEvent.setup();
        render(
            <ReconciliationForm
                account={mockAccount}
                onSuccess={mockOnSuccess}
                onCancel={mockOnCancel}
            />
        );

        const input = screen.getByTestId('declared-balance-input');
        await user.clear(input);
        await user.type(input, '450000'); // -50,000 difference (gasto de ajuste)

        // Verify difference warning appears
        expect(screen.getByText(/Diferencia:/i)).toBeInTheDocument();

        const submitBtn = screen.getByRole('button', { name: /^Reconciliar$/i });
        await user.click(submitBtn);

        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        });

        // 1. Verify reconciliation record was created
        const reconciliations = await db.reconciliations.toArray();
        expect(reconciliations).toHaveLength(1);
        expect(reconciliations[0].declaredBalance).toBe(450000);
        expect(reconciliations[0].calculatedBalance).toBe(500000);
        expect(reconciliations[0].difference).toBe(-50000);

        // 2. Verify adjustment transaction was created with isAdjustment = true
        const txs = await db.transactions.toArray();
        expect(txs).toHaveLength(1);
        expect(txs[0].isAdjustment).toBe(true);
        expect(txs[0].type).toBe('expense');
        expect(txs[0].amount).toBe(50000);
        expect(txs[0].description).toContain('Ajuste de reconciliación - Bancolombia Ahorros');

        // 3. Verify account balance was updated to declared balance
        const updatedAcc = await db.accounts.get(mockAccount.id);
        expect(updatedAcc?.calculatedBalance).toBe(450000);
        expect(updatedAcc?.actualBalance).toBe(450000);
    });

    it('performs exact reconciliation when declared balance matches calculated balance', async () => {
        const user = userEvent.setup();
        render(
            <ReconciliationForm
                account={mockAccount}
                onSuccess={mockOnSuccess}
                onCancel={mockOnCancel}
            />
        );

        // Balance already defaults to calculatedBalance (500000)
        expect(screen.getByText(/¡Perfecto! Los saldos coinciden/i)).toBeInTheDocument();

        const submitBtn = screen.getByRole('button', { name: /^Reconciliar$/i });
        await user.click(submitBtn);

        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        });

        // Reconciliations record created with difference = 0
        const reconciliations = await db.reconciliations.toArray();
        expect(reconciliations).toHaveLength(1);
        expect(reconciliations[0].difference).toBe(0);

        // No adjustment transaction should be created
        const txs = await db.transactions.toArray();
        expect(txs).toHaveLength(0);
    });
});
