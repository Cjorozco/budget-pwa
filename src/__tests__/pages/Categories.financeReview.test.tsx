import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { db } from '@/lib/db';
import Categories from '@/pages/Categories';

it('keeps an ambiguous family deposit intact while the user reviews its purpose', async () => {
    const since = Date.now() - 60_000;
    await db.categories.clear();
    await db.transactions.clear();
    await db.categories.add({
        id: 'other', name: 'Otros', type: 'income', color: '#6366f1', usageCount: 0, isActive: true,
    });
    const deposit = {
        id: 'family', type: 'income' as const, amount: 150000, categoryId: 'other', accountId: 'bank',
        description: 'Dinero de mamá para transporte a San José y mano de obra',
        date: since, tagIds: [], createdAt: since, updatedAt: since,
    };
    await db.transactions.add(deposit);
    render(<MemoryRouter><Categories /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar mis categorías y finanzas' }));
    const draft = within(screen.getByRole('dialog'));
    fireEvent.click(draft.getByRole('button', { name: 'Revisar' }));

    const purpose = await draft.findByRole('combobox', { name: 'Propósito por aclarar' });
    expect(purpose).toHaveValue('unknown');
    expect(draft.getByText(/Conserva un solo abono/)).toBeVisible();
    fireEvent.change(purpose, { target: { value: 'advance' } });
    expect(draft.getByRole('option', { name: 'Otros › Gastos por encargo' })).toBeInTheDocument();
    fireEvent.change(draft.getByRole('combobox', { name: 'Anticipo para un encargo' }), { target: { value: 'true' } });
    expect(draft.getByRole('option', { name: 'Fondos de terceros › Gastos por encargo' })).toBeInTheDocument();
    fireEvent.click(draft.getByRole('button', { name: 'Aceptar pauta' }));
    fireEvent.click(draft.getByRole('button', { name: 'Cerrar' }));
    expect(await db.transactions.get(deposit.id)).toEqual(deposit);
    expect(await db.categories.count()).toBe(1);
});
