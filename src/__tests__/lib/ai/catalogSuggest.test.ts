import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { suggestCategory } from '@/lib/ai/categorizer';

const root = (id: string, name: string) => ({
  id,
  name,
  type: 'expense' as const,
  color: '#0f766e',
  usageCount: 0,
  isActive: true,
});

const child = (id: string, name: string, parentId: string) => ({
  ...root(id, name),
  parentId,
});

describe('suggestCategory: declaración de renta', () => {
  beforeEach(async () => {
    await db.categories.clear();
    await db.transactions.clear();
  });

  it('offers to create the Impuestos subcategory instead of dumping it in the parent', async () => {
    await db.categories.bulkAdd([
      root('fin', 'Gastos financieros'),
      root('per', 'Gastos personales'),
    ]);

    const suggestion = await suggestCategory('Declaración de renta', 'expense');

    expect(suggestion?.needsCategoryCreation).toBe(true);
    expect(suggestion?.pendingCategory).toEqual({
      type: 'expense',
      parentName: 'Gastos financieros',
      subcategoryName: 'Impuestos',
    });
    // La raíz que ya tiene sigue a un clic de distancia.
    expect(suggestion?.alternatives?.[0].categoryId).toBe('fin');
  });

  it('uses the existing subcategory when the user already created it', async () => {
    await db.categories.bulkAdd([
      root('fin', 'Gastos financieros'),
      child('imp', 'Impuestos', 'fin'),
    ]);

    const suggestion = await suggestCategory('Declaración de renta', 'expense');

    expect(suggestion?.categoryId).toBe('imp');
    expect(suggestion?.needsCategoryCreation).toBe(false);
  });

  it('offers the full path when the user has no related category', async () => {
    await db.categories.bulkAdd([root('per', 'Gastos personales')]);

    const suggestion = await suggestCategory('Declaración de renta', 'expense');

    expect(suggestion?.needsCategoryCreation).toBe(true);
    expect(suggestion?.categoryPath).toContain('Impuestos');
    expect(suggestion?.alternatives).toBeUndefined();
  });

  it('keeps a matching leaf over a rule when the leaf is specific enough', async () => {
    await db.categories.bulkAdd([
      root('serv', 'Servicios básicos'),
      child('luz', 'Electricidad', 'serv'),
    ]);

    const suggestion = await suggestCategory('Pago electricidad', 'expense');

    expect(suggestion?.categoryId).toBe('luz');
    expect(suggestion?.needsCategoryCreation).toBe(false);
  });
});
