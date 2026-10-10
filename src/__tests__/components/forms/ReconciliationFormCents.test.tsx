import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReconciliationForm } from '@/components/forms/ReconciliationForm';
import { db } from '@/lib/db';
import { useRegionStore } from '@/lib/region/regionStore';
import { useI18nStore } from '@/lib/i18n/i18nStore';
import type { Account } from '@/lib/types';

describe('ReconciliationForm with cents (CAD)', () => {
    const account: Account = {
        id: 'acc-cad',
        name: 'Chequing',
        type: 'bank',
        calculatedBalance: 100.1,
        currency: 'CAD',
        isActive: true,
    };

    beforeEach(async () => {
        localStorage.clear();
        useRegionStore.setState({ country: 'CA' });
        useI18nStore.setState({ language: 'en' });
        await db.accounts.clear();
        await db.reconciliations.clear();
        await db.transactions.clear();
        await db.categories.clear();
        await db.accounts.add({ ...account });
    });

    afterEach(() => {
        localStorage.clear();
        useRegionStore.setState({ country: 'CO' });
        useI18nStore.setState({ language: 'es' });
    });

    it('treats a one-cent difference as a real difference', async () => {
        const user = userEvent.setup();
        render(<ReconciliationForm account={account} onSuccess={vi.fn()} onCancel={vi.fn()} />);

        const input = screen.getByTestId('declared-balance-input');
        await user.clear(input);
        await user.type(input, '100.11');

        await waitFor(() => expect(screen.getByTestId('reconciliation-diff')).toHaveTextContent('0.01'));
        expect(screen.getByText(/There is a difference of/i)).toBeInTheDocument();
    });

    it('creates an adjustment of exactly one cent and leaves the balance exact', async () => {
        const user = userEvent.setup();
        const onSuccess = vi.fn();
        render(<ReconciliationForm account={account} onSuccess={onSuccess} onCancel={vi.fn()} />);

        const input = screen.getByTestId('declared-balance-input');
        await user.clear(input);
        await user.type(input, '100.11');
        await user.click(screen.getByRole('button', { name: /^Match bank balance$/i }));

        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
        const [adjustment] = await db.transactions.toArray();
        expect(adjustment.amount).toBe(0.01);
        expect((await db.accounts.get('acc-cad'))?.calculatedBalance).toBe(100.11);
    });

    it('does not invent a difference when the amounts match', async () => {
        render(<ReconciliationForm account={account} onSuccess={vi.fn()} onCancel={vi.fn()} />);
        await waitFor(() => expect(screen.getByText(/Balances match/i)).toBeInTheDocument());
    });
});
