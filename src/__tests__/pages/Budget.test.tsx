import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Budget from '@/pages/Budget';
import { db } from '@/lib/db';
import { MemoryRouter } from 'react-router-dom';

describe('Budget Page - Generate budget from actuals', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    await db.transactions.clear();
    await db.categories.clear();
    await db.budgetItems.clear();
    await db.accounts.clear();

    await db.accounts.add({
      id: 'acc-1',
      name: 'Cuenta Principal',
      type: 'bank',
      calculatedBalance: 1000000,
      currency: 'COP',
      isActive: true,
    });

    // Parent expense category: Alimentación
    await db.categories.add({
      id: 'cat-food',
      name: 'Alimentación',
      type: 'expense',
      color: '#f97316',
      usageCount: 0,
      isActive: true,
    });

    // Subcategory: Supermercado (parent: Alimentación)
    await db.categories.add({
      id: 'cat-super',
      name: 'Supermercado',
      parentId: 'cat-food',
      type: 'expense',
      color: '#ef4444',
      usageCount: 0,
      isActive: true,
    });

    // Subcategory: Restaurantes (parent: Alimentación)
    await db.categories.add({
      id: 'cat-rest',
      name: 'Restaurantes',
      parentId: 'cat-food',
      type: 'expense',
      color: '#eab308',
      usageCount: 0,
      isActive: true,
    });

    // Standalone expense category: Servicios
    await db.categories.add({
      id: 'cat-services',
      name: 'Servicios',
      type: 'expense',
      color: '#3b82f6',
      usageCount: 0,
      isActive: true,
    });

    // Income category: Salario
    await db.categories.add({
      id: 'cat-salary',
      name: 'Salario',
      type: 'income',
      color: '#10b981',
      usageCount: 0,
      isActive: true,
    });
  });

  it('shows option to generate budget from previous month actuals when current month is empty', async () => {
    // Add transactions in 2099-09 (previous month to 2099-10)
    const prevMonthDate = new Date(2099, 8, 15).getTime(); // September 2099

    await db.transactions.bulkAdd([
      {
        id: 'tx-1',
        type: 'expense',
        amount: 300000,
        description: 'Supermercado',
        categoryId: 'cat-super',
        accountId: 'acc-1',
        date: prevMonthDate,
        tagIds: [],
        createdAt: prevMonthDate,
        updatedAt: prevMonthDate,
      },
      {
        id: 'tx-2',
        type: 'expense',
        amount: 150000,
        description: 'Cena restaurante',
        categoryId: 'cat-rest',
        accountId: 'acc-1',
        date: prevMonthDate,
        tagIds: [],
        createdAt: prevMonthDate,
        updatedAt: prevMonthDate,
      },
      {
        id: 'tx-3',
        type: 'expense',
        amount: 120000,
        description: 'Luz y agua',
        categoryId: 'cat-services',
        accountId: 'acc-1',
        date: prevMonthDate,
        tagIds: [],
        createdAt: prevMonthDate,
        updatedAt: prevMonthDate,
      },
      {
        id: 'tx-4',
        type: 'income',
        amount: 2500000,
        description: 'Nómina septiembre',
        categoryId: 'cat-salary',
        accountId: 'acc-1',
        date: prevMonthDate,
        tagIds: [],
        createdAt: prevMonthDate,
        updatedAt: prevMonthDate,
      },
    ]);

    // Render budget for October 2099
    render(
      <MemoryRouter initialEntries={['/budget?month=2099-10']}>
        <Budget />
      </MemoryRouter>
    );

    // Verify empty month banner appears with generate from actuals button (3 categories: Alimentación, Servicios, Salario)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Crear con consumos reales \(3\)/i })).toBeInTheDocument();
    });

    // Click "Crear con consumos reales (3)"
    const generateBtn = screen.getByRole('button', { name: /Crear con consumos reales \(3\)/i });
    fireEvent.click(generateBtn);

    // Review the editable draft before saving it.
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Revisa el presupuesto sugerido/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('Alimentación')).toBeInTheDocument();
    });

    expect(await db.budgetItems.where('month').equals('2099-10').count()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByText('Alimentación')).toBeInTheDocument());

    // Check items persisted in Dexie
    const items = await db.budgetItems.where('month').equals('2099-10').toArray();
    expect(items).toHaveLength(3);

    const foodItem = items.find((i) => i.name === 'Alimentación');
    expect(foodItem).toBeDefined();
    // 300000 (Supermercado) + 150000 (Restaurantes) = 450000
    expect(foodItem?.amount).toBe(450000);
    expect(foodItem?.type).toBe('expense');

    const salaryItem = items.find((i) => i.name === 'Salario');
    expect(salaryItem?.amount).toBe(2500000);
    expect(salaryItem?.type).toBe('income');

    // The user retains the ability to edit an item
    const editBtn = screen.getByLabelText(/Editar Alimentación/i);
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText('Editar Gasto Fijo')).toBeInTheDocument();
    });

    const amountInput = screen.getByDisplayValue('450.000');
    fireEvent.change(amountInput, { target: { value: '500000' } });

    const submitBtn = screen.getByRole('button', { name: /Actualizar Gasto/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const updatedItems = items;
      expect(updatedItems).toBeDefined();
    });

    const updatedInDb = await db.budgetItems.get(foodItem!.id);
    expect(updatedInDb?.amount).toBe(500000);
  });

  it('presents both copy from budget and generate from actuals buttons when both exist in previous month', async () => {
    const prevMonthDate = new Date(2099, 8, 15).getTime(); // September 2099

    // Theoretical budget in September 2099
    await db.budgetItems.add({
      id: 'b-prev-1',
      month: '2099-09',
      name: 'Presupuesto Teórico',
      amount: 1000000,
      type: 'expense',
      createdAt: prevMonthDate,
    });

    // Actual transaction in September 2099
    await db.transactions.add({
      id: 'tx-prev-1',
      type: 'expense',
      amount: 250000,
      description: 'Gasto real',
      categoryId: 'cat-services',
      accountId: 'acc-1',
      date: prevMonthDate,
      tagIds: [],
      createdAt: prevMonthDate,
      updatedAt: prevMonthDate,
    });

    render(
      <MemoryRouter initialEntries={['/budget?month=2099-10']}>
        <Budget />
      </MemoryRouter>
    );

    // Both buttons should be available
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copiar 1 ítems de septiembre/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Crear con consumos reales \(1\)/i })).toBeInTheDocument();
    });
  });
});
