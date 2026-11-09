import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from '@/components/forms/TransactionForm';
import { db } from '@/lib/db';
import { useLicenseStore } from '@/store/licenseStore';
import { useUIStore } from '@/store/ui';
import type { Category, Transaction } from '@/lib/types';

const category = (id: string, name: string, parentId?: string): Category => ({
    id,
    name,
    type: 'expense',
    color: '#0f766e',
    parentId,
    usageCount: 0,
    isActive: true,
});

async function openForm(initialData?: Transaction) {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    const view = render(<TransactionForm onSuccess={onSuccess} initialData={initialData} />);
    await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Banco' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Restaurantes' })).toBeInTheDocument();
    });
    return { user, onSuccess, view };
}

async function fillAmountAndDescription(user: ReturnType<typeof userEvent.setup>, description: string) {
    await user.type(screen.getByTestId('amount-input'), '1000');
    await user.type(screen.getByTestId('description-input'), description);
    await user.tab();
    await user.selectOptions(screen.getByTestId('account-select'), 'acc-1');
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: /Guardar transacción/i }));

describe('TransactionForm subcategory suggestion', () => {
    beforeEach(async () => {
        useLicenseStore.setState({ isPro: false });
        useUIStore.setState({ toasts: [] });
        await Promise.all([
            db.transactions.clear(),
            db.accounts.clear(),
            db.categories.clear(),
            db.reserves.clear(),
            db.suggestionValidations.clear(),
            db.userKeywordRules.clear(),
        ]);
        await db.accounts.add({ id: 'acc-1', name: 'Banco', type: 'bank', calculatedBalance: 5_000, currency: 'COP', isActive: true });
        await db.categories.bulkAdd([
            category('daily', 'Gastos diarios'),
            category('super', 'Supermercado', 'daily'),
            category('rest', 'Restaurantes', 'daily'),
            category('debt', 'Deuda'),
            category('debt-personal', 'Préstamo personal', 'debt'),
            category('debt-card', 'Tarjeta de crédito', 'debt'),
        ]);
    });

    it('does not fill the category or save until the user confirms', async () => {
        const { user, onSuccess } = await openForm();
        await fillAmountAndDescription(user, 'Supermercado');
        await screen.findByTestId('category-suggestion-panel');

        expect(screen.getByTestId('category-select')).toHaveValue('');
        await save(user);

        await screen.findByText(/Categoría requerida/i);
        expect(onSuccess).not.toHaveBeenCalled();
        expect(await db.transactions.count()).toBe(0);
    });

    it('saves the accepted suggestion and learns it only when the movement is saved', async () => {
        const { user, onSuccess } = await openForm();
        await fillAmountAndDescription(user, 'Supermercado');
        await user.click(await screen.findByTestId('apply-category-button'));

        await waitFor(() => expect(screen.getByTestId('category-select')).toHaveValue('super'));
        expect(await db.suggestionValidations.count()).toBe(0);

        await save(user);
        await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());

        expect((await db.transactions.toArray())[0].categoryId).toBe('super');
        expect(await db.suggestionValidations.get('expense:supermercado')).toMatchObject({ categoryId: 'super' });
    });

    it('learns a manual change and suggests it next time', async () => {
        const first = await openForm();
        await fillAmountAndDescription(first.user, 'Supermercado');
        await screen.findByTestId('category-suggestion-panel');
        await first.user.selectOptions(screen.getByTestId('category-select'), 'rest');
        await save(first.user);
        await waitFor(() => expect(first.onSuccess).toHaveBeenCalledOnce());
        first.view.unmount();

        const second = await openForm();
        await second.user.type(screen.getByTestId('description-input'), 'Supermercado');

        expect(await screen.findByTestId('category-suggestion-panel')).toHaveTextContent('Restaurantes');
    });

    it('asks to choose when there is no suggestion', async () => {
        const { user } = await openForm();
        await user.type(screen.getByTestId('description-input'), 'Xyzqwk');

        expect(await screen.findByTestId('no-suggestion-message')).toHaveTextContent(/elige una subcategoría/i);
    });

    it('shows no suggestion and no message for a blank description', async () => {
        const { user } = await openForm();
        await user.type(screen.getByTestId('description-input'), '   ');
        await user.tab();

        expect(screen.queryByTestId('category-suggestion-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('no-suggestion-message')).not.toBeInTheDocument();
    });

    it('makes the user pick a subcategory when only the parent is known', async () => {
        const { user } = await openForm();
        await fillAmountAndDescription(user, 'Pago préstamo');
        await screen.findByTestId('category-suggestion-panel');

        expect(screen.queryByTestId('apply-category-button')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Deuda › Préstamo personal' }));

        await waitFor(() => expect(screen.getByTestId('category-select')).toHaveValue('debt-personal'));
    });

    const existing: Transaction = {
        id: 'tx-1',
        type: 'expense',
        amount: 1_000,
        description: 'Compra del barrio',
        date: 1_000,
        categoryId: 'super',
        tagIds: [],
        accountId: 'acc-1',
        createdAt: 1_000,
        updatedAt: 1_000,
    };

    it('learns when editing changes the category', async () => {
        await db.transactions.add(existing);
        const { user, onSuccess } = await openForm(existing);

        await user.selectOptions(screen.getByTestId('category-select'), 'rest');
        await user.click(screen.getByRole('button', { name: /Actualizar/i }));
        await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());

        expect(await db.suggestionValidations.get('expense:compra del barrio')).toMatchObject({ categoryId: 'rest' });
    });

    it('learns nothing when editing keeps the category', async () => {
        await db.transactions.add(existing);
        const { user, onSuccess } = await openForm(existing);

        await user.click(screen.getByRole('button', { name: /Actualizar/i }));
        await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());

        expect(await db.suggestionValidations.count()).toBe(0);
    });
});
