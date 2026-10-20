import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  TransactionItem,
  TransactionItemSkeleton,
  TransactionsEmpty,
} from '@/components/transactions/TransactionItem';
import { BalanceSummaryCard } from '@/components/transactions/BalanceSummaryCard';

const baseItem = {
  title: 'pago NETFLIX',
  subtitle: '30 abr, 2026 • Bancolombia',
  categoryLabel: 'Ocio',
  amount: 100,
  iconColor: '#ef4444',
  icon: 'O',
};

describe('TransactionItem', () => {
  it('shows an expense with a minus sign and the expense color', () => {
    render(<ul><TransactionItem {...baseItem} direction="out" /></ul>);
    const amount = screen.getByText(/^-/);
    expect(amount).toHaveClass('text-expense');
  });

  it('shows an income with a plus sign and the income color', () => {
    render(<ul><TransactionItem {...baseItem} direction="in" /></ul>);
    const amount = screen.getByText(/^\+/);
    expect(amount).toHaveClass('text-income');
  });

  it('keeps the user text untouched (no capitalization)', () => {
    render(<ul><TransactionItem {...baseItem} direction="out" /></ul>);
    expect(screen.getByText('pago NETFLIX')).toBeInTheDocument();
  });

  it('renders the badges and actions slots', () => {
    render(
      <ul>
        <TransactionItem
          {...baseItem}
          direction="out"
          badges={<span>Revisar</span>}
          actions={<button aria-label="Eliminar">x</button>}
        />
      </ul>
    );
    expect(screen.getByText('Revisar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });
});

describe('TransactionItemSkeleton', () => {
  it('is announced as loading and is a list item', () => {
    render(<ul><TransactionItemSkeleton /></ul>);
    expect(screen.getByRole('listitem')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('TransactionsEmpty', () => {
  it('shows the given message', () => {
    render(<TransactionsEmpty message="No hay movimientos" />);
    expect(screen.getByText('No hay movimientos')).toBeInTheDocument();
  });
});

describe('BalanceSummaryCard', () => {
  const card = { balance: 7783, expense: 1187.4, goalAmount: 20000 };

  it('exposes the progress with a clamped value', () => {
    render(<BalanceSummaryCard {...card} spentPercent={140} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('clamps negative progress to zero', () => {
    render(<BalanceSummaryCard {...card} spentPercent={-5} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows only a loading status while loading', () => {
    render(<BalanceSummaryCard {...card} spentPercent={30} isLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('cn with kit tokens', () => {
  it('keeps text-body next to a color token (tailwind-merge must know both)', async () => {
    const { cn } = await import('@/lib/utils');
    expect(cn('text-body font-semibold', 'text-income')).toBe('text-body font-semibold text-income');
    expect(cn('text-caption', 'text-body')).toBe('text-body');
  });
});

describe('TransactionItem motion', () => {
  const base = {
    title: 'Bus',
    subtitle: '17 oct, 2026 • Efectivo',
    categoryLabel: 'Transporte',
    amount: 2900,
    direction: 'out' as const,
    iconColor: '#60a5fa',
    icon: 'T',
  };

  it('does not move the item when the user prefers reduced motion', async () => {
    const { MotionConfig } = await import('motion/react');
    render(
      <MotionConfig reducedMotion="always">
        <ul><TransactionItem {...base} /></ul>
      </MotionConfig>
    );
    const li = screen.getByTestId('transaction-item');
    // Reduced motion jumps straight to the final position, well before the 250 ms entrance would end.
    await waitFor(
      () => expect(li.style.transform === '' || li.style.transform === 'none').toBe(true),
      { timeout: 150 }
    );
  });

  it('starts the entrance below its final position when motion is allowed', () => {
    render(<ul><TransactionItem {...base} /></ul>);
    expect(screen.getByTestId('transaction-item').style.transform).toContain('translateY(8px)');
  });
});
