import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { findCategoryByPath, findOrCreateCategory } from '@/lib/ai/categoryResolver';

describe('findCategoryByPath', () => {
  beforeEach(async () => {
    await db.categories.clear();
  });

  it('matches Publico as Transporte público under Transporte', async () => {
    await db.categories.bulkAdd([
      {
        id: 'transporte',
        name: 'Transporte',
        type: 'expense',
        color: '#0ea5e9',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'publico',
        name: 'Publico',
        type: 'expense',
        color: '#0ea5e9',
        parentId: 'transporte',
        usageCount: 0,
        isActive: true,
      },
    ]);

    const found = await findCategoryByPath('expense', 'Transporte', 'Transporte público');
    expect(found?.id).toBe('publico');
  });

  it('matches Sofia parent regardless of accent', async () => {
    await db.categories.bulkAdd([
      {
        id: 'sofia',
        name: 'Sofía',
        type: 'expense',
        color: '#ec4899',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'sofia-transporte',
        name: 'Transporte',
        type: 'expense',
        color: '#ec4899',
        parentId: 'sofia',
        usageCount: 0,
        isActive: true,
      },
    ]);

    const found = await findCategoryByPath('expense', 'Sofia', 'Transporte');
    expect(found?.id).toBe('sofia-transporte');
  });
});

describe('findOrCreateCategory', () => {
  beforeEach(async () => {
    await db.categories.clear();
  });

  it('reuses Publico instead of creating Transporte público', async () => {
    await db.categories.bulkAdd([
      {
        id: 'transporte',
        name: 'Transporte',
        type: 'expense',
        color: '#0ea5e9',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'publico',
        name: 'Publico',
        type: 'expense',
        color: '#0ea5e9',
        parentId: 'transporte',
        usageCount: 0,
        isActive: true,
      },
    ]);

    const id = await findOrCreateCategory('expense', 'Transporte', 'Transporte público');
    expect(id).toBe('publico');

    const children = await db.categories.filter((c) => c.parentId === 'transporte').toArray();
    expect(children).toHaveLength(1);
  });
});
