import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReconciliationForm } from '@/components/forms/ReconciliationForm';
import { db } from '@/lib/db';
import { useRegionStore } from '@/lib/region/regionStore';
import { useI18nStore } from '@/lib/i18n/i18nStore';
import type { Account } from '@/lib/types';

describe('ReconciliationForm adjustment category by language', () => {
    const account: Account = { id: 'acc-1', name: 'Chequing', type: 'bank', calculatedBalance: 100, currency: 'CAD', isActive: true };

    beforeEach(async () => {
        localStorage.clear();
        useRegionStore.setState({ country: 'CA' });
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

    const reconcileTo = async (value: string, buttonName: RegExp) => {
        const user = userEvent.setup();
        const onSuccess = vi.fn();
        const current = (await db.accounts.get('acc-1'))!;
        render(<ReconciliationForm account={current} onSuccess={onSuccess} onCancel={vi.fn()} />);
        const input = screen.getByTestId('declared-balance-input');
        await user.clear(input);
        await user.type(input, value);
        await user.click(screen.getByRole('button', { name: buttonName }));
        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    };

    it('creates the category and the description in English, with its canonical key', async () => {
        useI18nStore.setState({ language: 'en' });
        await reconcileTo('90', /^Match bank balance$/i);

        const category = await db.categories.filter((c) => c.seedKey === 'Ajuste de Reconciliación').first();
        expect(category?.name).toBe('Balance adjustment');
        const [adjustment] = await db.transactions.toArray();
        expect(adjustment.description).toBe('Balance adjustment - Chequing');
        expect(adjustment.categoryId).toBe(category?.id);
    });

    it('in French too', async () => {
        useI18nStore.setState({ language: 'fr' });
        await reconcileTo('90', /^Aligner le solde$/i);

        const [adjustment] = await db.transactions.toArray();
        expect(adjustment.description).toBe('Ajustement de solde - Chequing');
        expect((await db.categories.get(adjustment.categoryId))?.name).toBe('Ajustement de solde');
    });

    it('reuses the same category after the language changes, instead of creating a second one', async () => {
        useI18nStore.setState({ language: 'en' });
        await reconcileTo('90', /^Match bank balance$/i);

        useI18nStore.setState({ language: 'es' });
        document.body.innerHTML = '';
        await reconcileTo('95', /^Cuadrar saldo$/i);

        const categories = await db.categories.filter((c) => c.seedKey === 'Ajuste de Reconciliación').toArray();
        expect(categories).toHaveLength(1);
        const transactions = await db.transactions.toArray();
        expect(new Set(transactions.map((t) => t.categoryId)).size).toBe(1);
        expect(transactions.some((t) => t.description === 'Ajuste de reconciliación - Chequing')).toBe(true);
    });

    it('still finds the legacy Spanish category created before keys existed', async () => {
        await db.categories.add({ id: 'legacy', name: 'Ajuste de Reconciliación', type: 'expense', color: '#64748b', usageCount: 3, isActive: true });
        useI18nStore.setState({ language: 'es' });
        await reconcileTo('90', /^Cuadrar saldo$/i);

        expect(await db.categories.count()).toBe(1);
        const [adjustment] = await db.transactions.toArray();
        expect(adjustment.categoryId).toBe('legacy');
    });
});
