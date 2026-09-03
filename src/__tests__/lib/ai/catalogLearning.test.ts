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

describe('Custom category matching and learning (Sofia › Ruta vs generic Niños)', () => {
    beforeEach(async () => {
        await db.categories.clear();
        await db.transactions.clear();
    });

    it('matches custom user category Sofia › Ruta for "Uber al jardín" without proposing Niños › Transporte', async () => {
        await db.categories.bulkAdd([
            root('cat-sofia', 'Sofía'),
            child('cat-ruta', 'Ruta', 'cat-sofia'),
            root('cat-food', 'Alimentación'),
            child('cat-super', 'Supermercado', 'cat-food'),
        ]);

        const suggestion = await suggestCategory('Uber al jardín', 'expense');

        expect(suggestion).not.toBeNull();
        expect(suggestion?.categoryId).toBe('cat-ruta');
        expect(suggestion?.categoryPath).toBe('Sofía › Ruta');
        expect(suggestion?.needsCategoryCreation).toBe(false);
    });

    it('prioritizes existing root Sofia over creating an unprompted generic root Niños', async () => {
        await db.categories.bulkAdd([
            root('cat-sofia', 'Sofía'),
            root('cat-trans', 'Transporte'),
            child('cat-priv', 'Privado', 'cat-trans'),
        ]);

        const suggestion = await suggestCategory('Uber al jardín', 'expense');

        expect(suggestion).not.toBeNull();
        expect(suggestion?.categoryPath).not.toContain('Niños');
        expect(suggestion?.needsCategoryCreation).toBe(false);
    });

    it('learns from previous user transactions (historical memory)', async () => {
        await db.categories.bulkAdd([
            root('cat-sofia', 'Sofía'),
            child('cat-ruta', 'Ruta', 'cat-sofia'),
        ]);

        await db.transactions.add({
            id: 'tx-1',
            type: 'expense',
            amount: 15000,
            description: 'Uber al jardín',
            date: Date.now() - 86400000,
            categoryId: 'cat-ruta',
            tagIds: [],
            accountId: 'acc-1',
            wasCategorySuggestionAccepted: true,
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now() - 86400000,
        });

        const suggestion = await suggestCategory('Uber al jardín', 'expense');

        expect(suggestion).not.toBeNull();
        expect(suggestion?.categoryId).toBe('cat-ruta');
        expect(suggestion?.confidence).toBeGreaterThanOrEqual(0.9);
        expect(suggestion?.reason).toContain('transacciones');
    });
});
