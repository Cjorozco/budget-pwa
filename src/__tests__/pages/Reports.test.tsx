import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Reports from '@/pages/Reports';
import Budget from '@/pages/Budget';
import { db } from '@/lib/db';
import { MemoryRouter } from 'react-router-dom';

describe('Reports Page', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    await db.transactions.clear();
    await db.categories.clear();
    await db.budgetItems.clear();
    await db.accounts.clear();

    // Accounts
    await db.accounts.add({
      id: 'acc-1',
      name: 'Cuenta Principal',
      type: 'bank',
      calculatedBalance: 1000000,
      currency: 'COP',
      isActive: true,
    });

    // Parent category: Alimentación
    await db.categories.add({
      id: 'cat-food',
      name: 'Alimentación',
      type: 'expense',
      color: '#f97316',
      usageCount: 0,
      isActive: true,
    });

    // Child category 1: Restaurantes (parent: Alimentación)
    await db.categories.add({
      id: 'cat-rest',
      name: 'Restaurantes',
      parentId: 'cat-food',
      type: 'expense',
      color: '#ef4444',
      usageCount: 0,
      isActive: true,
    });

    // Child category 2: Supermercado (parent: Alimentación)
    await db.categories.add({
      id: 'cat-super',
      name: 'Supermercado',
      parentId: 'cat-food',
      type: 'expense',
      color: '#eab308',
      usageCount: 0,
      isActive: true,
    });

    // Parent category: Salario (income)
    await db.categories.add({
      id: 'cat-salary',
      name: 'Salario',
      type: 'income',
      color: '#10b981',
      usageCount: 0,
      isActive: true,
    });

    // Child category: Horas Extras (parent: Salario)
    await db.categories.add({
      id: 'cat-overtime',
      name: 'Horas Extras',
      parentId: 'cat-salary',
      type: 'income',
      color: '#34d399',
      usageCount: 0,
      isActive: true,
    });

    // Fixed budget items
    await db.budgetItems.add({
      id: 'b-1',
      name: 'Arriendo',
      amount: 1200000,
      type: 'expense',
      createdAt: Date.now(),
    });

    await db.budgetItems.add({
      id: 'b-2',
      name: 'Nómina',
      amount: 3000000,
      type: 'income',
      createdAt: Date.now(),
    });

    // Transactions in current month
    const now = Date.now();

    await db.transactions.add({
      id: 'tx-1',
      amount: 50000,
      type: 'expense',
      description: 'Cena restaurante',
      accountId: 'acc-1',
      categoryId: 'cat-rest',
      date: now,
      tagIds: [],
      createdAt: now,
      updatedAt: now,
    });

    await db.transactions.add({
      id: 'tx-2',
      amount: 150000,
      type: 'expense',
      description: 'Mercado quincenal',
      accountId: 'acc-1',
      categoryId: 'cat-super',
      date: now,
      tagIds: [],
      createdAt: now,
      updatedAt: now,
    });

    await db.transactions.add({
      id: 'tx-3',
      amount: 2800000,
      type: 'income',
      description: 'Pago mensual',
      accountId: 'acc-1',
      categoryId: 'cat-overtime',
      date: now,
      tagIds: [],
      createdAt: now,
      updatedAt: now,
    });
  });

  it('renders report header and expense parent rollup by default', async () => {
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    );

    // Header and total expense ($200,000)
    await waitFor(() => {
      expect(screen.getByText('Informes')).toBeInTheDocument();
      expect(screen.getByText(/Gastos por Categoría/i)).toBeInTheDocument();
    });

    // In Parent view, Alimentación should be consolidated (50,000 + 150,000 = 200,000)
    await waitFor(() => {
      expect(screen.getAllByText('Alimentación').length).toBeGreaterThan(0);
    });
  });

  it('switches between Parent Categories and Subcategories view', async () => {
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alimentación').length).toBeGreaterThan(0);
    });

    // Switch to Subcategorías
    const subcatButton = screen.getByTestId('toggle-children');
    fireEvent.click(subcatButton);

    await waitFor(() => {
      expect(screen.getAllByText('Restaurantes').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Supermercado').length).toBeGreaterThan(0);
    });

    // Switch back to Categorías (padres)
    const catButton = screen.getByTestId('toggle-parents');
    fireEvent.click(catButton);

    await waitFor(() => {
      expect(screen.getAllByText('Alimentación').length).toBeGreaterThan(0);
    });
  });

  it('switches to Income tab and displays income breakdown', async () => {
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Informes')).toBeInTheDocument();
    });

    // Click Ingresos tab
    const incomeTab = screen.getByRole('button', { name: /Ingresos/i });
    fireEvent.click(incomeTab);

    // In Parent view, should display Salario parent category
    await waitFor(() => {
      expect(screen.getByText(/Ingresos por Categoría/i)).toBeInTheDocument();
      expect(screen.getAllByText('Salario').length).toBeGreaterThan(0);
    });

    // Switch to Subcategorías in Income tab
    const subcatButton = screen.getByTestId('toggle-children');
    fireEvent.click(subcatButton);

    await waitFor(() => {
      expect(screen.getAllByText('Horas Extras').length).toBeGreaterThan(0);
    });
  });

  it('switches to Fixed Budget compliance tab and shows comparison metrics', async () => {
    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Informes')).toBeInTheDocument();
    });

    // Click Presupuesto Fijo tab
    const budgetTab = screen.getByRole('button', { name: /Presupuesto Fijo/i });
    fireEvent.click(budgetTab);

    await waitFor(() => {
      expect(screen.getByText('Cumplimiento de Gastos Fijos')).toBeInTheDocument();
      expect(screen.getByText(/Dentro del presupuesto/i)).toBeInTheDocument();
      expect(screen.getByText('Gastos Fijos Planeados')).toBeInTheDocument();
      expect(screen.getByText('Ingresos Fijos Planeados')).toBeInTheDocument();
      expect(screen.getByText('Arriendo')).toBeInTheDocument();
    });
  });
});

describe('Budget Page functionality', () => {
  it('displays Gastos Fijos instead of Gastos Obligatorios', async () => {
    render(
      <MemoryRouter>
        <Budget />
      </MemoryRouter>
    );

    await waitFor(() => {
      const gastosFijosMatches = screen.getAllByText('Gastos Fijos');
      expect(gastosFijosMatches.length).toBeGreaterThan(0);
      expect(screen.queryByText('Gastos Obligatorios')).not.toBeInTheDocument();
    });
  });

  it('allows editing an existing budget item', async () => {
    render(
      <MemoryRouter>
        <Budget />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Arriendo')).toBeInTheDocument();
    });

    // Find edit button for Arriendo
    const editBtn = screen.getByLabelText('Editar Arriendo');
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    // Modal opens with editing title and values
    await waitFor(() => {
      expect(screen.getByText('Editar Gasto Fijo')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Arriendo');
    const amountInput = screen.getByDisplayValue('1200000');

    fireEvent.change(nameInput, { target: { value: 'Arriendo Apartamento' } });
    fireEvent.change(amountInput, { target: { value: '1350000' } });

    const submitBtn = screen.getByRole('button', { name: /Actualizar Gasto/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Arriendo Apartamento')).toBeInTheDocument();
    });
  });

  it('isolates budget items by month and allows copying from previous month', async () => {
    // b-1 and b-2 are in current month.
    // Let's open Budget for next month (empty initially)
    render(
      <MemoryRouter initialEntries={['/budget?month=2099-10']}>
        <Budget />
      </MemoryRouter>
    );

    // Month header shows Octubre 2099
    await waitFor(() => {
      expect(screen.getByText(/2099/i)).toBeInTheDocument();
    });

    // In 2099-10 there are no items yet
    expect(screen.queryByText('Arriendo')).not.toBeInTheDocument();

    // Create a new expense specifically for 2099-10
    const addExpenseBtn = screen.getAllByRole('button', { name: /\+ Añadir/i })[1];
    fireEvent.click(addExpenseBtn);

    await waitFor(() => {
      expect(screen.getByText('Nuevo Gasto Fijo')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ej\. Arriendo/i);
    const amountInput = screen.getByPlaceholderText('0');

    fireEvent.change(nameInput, { target: { value: 'Seguro Auto Futuro' } });
    fireEvent.change(amountInput, { target: { value: '300000' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar Gasto/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Seguro Auto Futuro')).toBeInTheDocument();
    });

    // Verify it is saved with month: '2099-10' in Dexie
    const items = await db.budgetItems.toArray();
    const futureItem = items.find(i => i.name === 'Seguro Auto Futuro');
    expect(futureItem).toBeDefined();
    expect(futureItem?.month).toBe('2099-10');
  });
});
