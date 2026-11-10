import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupportCard } from '@/components/SupportCard';
import { db } from '@/lib/db';
import { SUPPORT_CARD_DISMISSED_KEY, SUPPORT_MIN_TRANSACTIONS } from '@/lib/support';
import type { Transaction } from '@/lib/types';

const URL = 'https://store.example/checkout/buy/abc';

const makeTransactions = (count: number, idPrefix = 'tx-'): Transaction[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `${idPrefix}${i}`,
        type: 'expense',
        amount: 1000,
        description: `Gasto ${i}`,
        date: Date.now(),
        categoryId: 'cat',
        tagIds: [],
        accountId: 'acc',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    }));

/** Lets the live queries settle before asserting that nothing is shown. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

describe('SupportCard', () => {
    beforeEach(async () => {
        localStorage.clear();
        await Promise.all([db.transactions.clear(), db.budgetItems.clear(), db.quickTemplates.clear()]);
    });

    it('shows the coffee link once the user has enough real movements', async () => {
        await db.transactions.bulkAdd(makeTransactions(SUPPORT_MIN_TRANSACTIONS));
        render(<SupportCard url={URL} />);

        const link = await screen.findByRole('link', { name: /Invítame un café/i });
        expect(link).toHaveAttribute('href', URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('stays hidden while the user has few movements', async () => {
        await db.transactions.bulkAdd(makeTransactions(SUPPORT_MIN_TRANSACTIONS - 1));
        render(<SupportCard url={URL} />);
        await settle();

        expect(screen.queryByTestId('support-card')).toBeNull();
    });

    it('stays hidden with demo data loaded', async () => {
        await db.transactions.bulkAdd(makeTransactions(SUPPORT_MIN_TRANSACTIONS + 5, 'demo-'));
        render(<SupportCard url={URL} />);
        await settle();

        expect(screen.queryByTestId('support-card')).toBeNull();
    });

    it('stays hidden when there is no checkout link', async () => {
        await db.transactions.bulkAdd(makeTransactions(SUPPORT_MIN_TRANSACTIONS));
        render(<SupportCard url="" />);
        await settle();

        expect(screen.queryByTestId('support-card')).toBeNull();
    });

    it('hides on dismiss and does not come back', async () => {
        await db.transactions.bulkAdd(makeTransactions(SUPPORT_MIN_TRANSACTIONS));
        const user = userEvent.setup();
        const { unmount } = render(<SupportCard url={URL} />);

        await user.click(await screen.findByRole('button', { name: /No volver a mostrar/i }));
        await waitFor(() => expect(screen.queryByTestId('support-card')).toBeNull());
        expect(localStorage.getItem(SUPPORT_CARD_DISMISSED_KEY)).toBe('1');

        unmount();
        render(<SupportCard url={URL} />);
        await settle();
        expect(screen.queryByTestId('support-card')).toBeNull();
    });
});
