import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuggestionRulesSection } from '@/components/categories/SuggestionRulesSection';
import { db } from '@/lib/db';
import { learnCategoryForDescription } from '@/lib/ai/suggestionValidation';
import { addUserKeywordRule } from '@/lib/ai/userKeywordRules';
import { useUIStore } from '@/store/ui';
import type { Category } from '@/lib/types';

const category = (id: string, name: string, parentId?: string): Category => ({
    id,
    name,
    type: 'expense',
    color: '#0f766e',
    parentId,
    usageCount: 0,
    isActive: true,
});

async function confirmDialog(answer: boolean) {
    await waitFor(() => expect(useUIStore.getState().confirmDialog).not.toBeNull());
    useUIStore.getState().closeConfirmDialog(answer);
}

describe('SuggestionRulesSection', () => {
    beforeEach(async () => {
        useUIStore.setState({ toasts: [], confirmDialog: null });
        await Promise.all([db.categories.clear(), db.userKeywordRules.clear(), db.suggestionValidations.clear()]);
        await db.categories.bulkAdd([
            category('transport', 'Transporte'),
            category('public', 'Transporte público', 'transport'),
            category('daily', 'Gastos diarios'),
            category('super', 'Supermercado', 'daily'),
        ]);
    });

    it('adds a keyword for a subcategory', async () => {
        const user = userEvent.setup();
        render(<SuggestionRulesSection />);
        await screen.findByRole('option', { name: 'Transporte › Transporte público' });

        await user.type(screen.getByLabelText('Palabra clave'), 'Peaje');
        await user.selectOptions(screen.getByLabelText('Subcategoría'), 'public');
        await user.click(screen.getByRole('button', { name: 'Agregar' }));

        await screen.findByText('peaje');
        expect(await db.userKeywordRules.get('expense:peaje')).toMatchObject({ categoryId: 'public' });
    });

    it('offers subcategories but not their parents', async () => {
        render(<SuggestionRulesSection />);
        await screen.findByRole('option', { name: 'Transporte › Transporte público' });

        expect(screen.queryByRole('option', { name: 'Transporte' })).not.toBeInTheDocument();
    });

    it('rejects a keyword that is too short', async () => {
        const user = userEvent.setup();
        render(<SuggestionRulesSection />);
        await screen.findByRole('option', { name: 'Transporte › Transporte público' });

        await user.type(screen.getByLabelText('Palabra clave'), 'a');
        await user.selectOptions(screen.getByLabelText('Subcategoría'), 'public');
        await user.click(screen.getByRole('button', { name: 'Agregar' }));

        await screen.findByText(/al menos 3 caracteres/i);
        expect(await db.userKeywordRules.count()).toBe(0);
    });

    it('deletes a keyword only after confirming', async () => {
        await addUserKeywordRule({ keyword: 'peaje', categoryId: 'public' });
        const user = userEvent.setup();
        render(<SuggestionRulesSection />);
        const button = await screen.findByRole('button', { name: 'Eliminar peaje' });

        await user.click(button);
        await confirmDialog(false);
        expect(await db.userKeywordRules.count()).toBe(1);

        await user.click(button);
        await confirmDialog(true);
        await waitFor(async () => expect(await db.userKeywordRules.count()).toBe(0));
    });

    it('lists and forgets a learned description without touching movements', async () => {
        await learnCategoryForDescription({
            description: 'Compra del barrio',
            type: 'expense',
            categoryId: 'super',
            categoryPath: 'Gastos diarios › Supermercado',
        });
        const user = userEvent.setup();
        render(<SuggestionRulesSection />);

        await screen.findByText('compra del barrio');
        await user.click(screen.getByRole('button', { name: 'Eliminar compra del barrio' }));
        await confirmDialog(true);

        await waitFor(async () => expect(await db.suggestionValidations.count()).toBe(0));
    });

    it('shows the empty states', async () => {
        render(<SuggestionRulesSection />);

        expect(await screen.findByText(/Todavía no tienes palabras clave/i)).toBeInTheDocument();
        expect(screen.getByText(/cuando guardas un movimiento/i)).toBeInTheDocument();
    });
});
