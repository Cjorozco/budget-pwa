import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { suggestCategory } from '@/lib/ai/categorizer';

describe('suggestCategory against the user catalog', () => {
  beforeEach(async () => {
    await db.categories.clear();
    await db.transactions.clear();
  });

  it('suggests Gastos financieros for declaración de renta, not Gastos personales', async () => {
    await db.categories.bulkAdd([
      {
        id: 'fin',
        name: 'Gastos financieros',
        type: 'expense',
        color: '#0f766e',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'per',
        name: 'Gastos personales',
        type: 'expense',
        color: '#7c3aed',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'predial',
        name: 'Impuestos a la propiedad',
        type: 'expense',
        color: '#a855f7',
        parentId: 'vivienda',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'vivienda',
        name: 'Vivienda',
        type: 'expense',
        color: '#a855f7',
        usageCount: 0,
        isActive: true,
      },
    ]);

    const suggestion = await suggestCategory('Declaración de renta', 'expense');
    expect(suggestion?.categoryId).toBe('fin');
    expect(suggestion?.needsCategoryCreation).toBe(false);
    expect(suggestion?.alternatives).toBeUndefined();
  });

  it('offers to create Gastos financieros › Impuestos when the user has no similar category', async () => {
    const suggestion = await suggestCategory('Declaración de renta', 'expense');
    expect(suggestion?.needsCategoryCreation).toBe(true);
    expect(suggestion?.pendingCategory).toEqual({
      type: 'expense',
      parentName: 'Gastos financieros',
      subcategoryName: 'Impuestos',
    });
  });
});
