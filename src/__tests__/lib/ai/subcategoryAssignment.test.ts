import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { suggestCategory } from '@/lib/ai/categorizer';
import {
    addUserKeywordRule,
    deleteUserKeywordRule,
    matchUserKeywordRules,
    normalizeKeyword,
} from '@/lib/ai/userKeywordRules';
import {
    deleteValidatedSuggestion,
    getValidatedSuggestion,
    learnCategoryForDescription,
    saveValidatedSuggestion,
} from '@/lib/ai/suggestionValidation';
import type { Category, Transaction } from '@/lib/types';

const root = (id: string, name: string, type: Category['type'] = 'expense'): Category => ({
    id,
    name,
    type,
    color: '#0f766e',
    usageCount: 0,
    isActive: true,
});
const child = (id: string, name: string, parentId: string, type: Category['type'] = 'expense'): Category => ({
    ...root(id, name, type),
    parentId,
});

const tx = (id: string, description: string, categoryId: string, date: number, extra: Partial<Transaction> = {}): Transaction => ({
    id,
    type: 'expense',
    amount: 10,
    description,
    date,
    categoryId,
    tagIds: [],
    accountId: 'acc-1',
    createdAt: date,
    updatedAt: date,
    ...extra,
});

const catalog: Category[] = [
    root('daily', 'Gastos diarios'),
    child('super', 'Supermercado', 'daily'),
    child('rest', 'Restaurantes', 'daily'),
    root('transport', 'Transporte'),
    child('private', 'Privado', 'transport'),
    child('public', 'Transporte público', 'transport'),
    child('transport-other', 'Otros', 'transport'),
    root('kids', 'Niños'),
    child('kids-transport', 'Transporte', 'kids'),
    root('trips', 'Viajes'),
    child('trips-transport', 'Transporte', 'trips'),
    root('debt', 'Deuda'),
    child('debt-card', 'Tarjeta de crédito', 'debt'),
    child('debt-personal', 'Préstamo personal', 'debt'),
    child('debt-student', 'Préstamo estudiantil', 'debt'),
    child('debt-other', 'Otros', 'debt'),
    root('salary', 'Salario', 'income'),
    child('payroll', 'Nómina', 'salary', 'income'),
];

beforeEach(async () => {
    await db.categories.clear();
    await db.transactions.clear();
    await db.suggestionValidations.clear();
    await db.userKeywordRules.clear();
    await db.categories.bulkAdd(catalog);
});

describe('category moved to the other movement type', () => {
    const moveToIncome = (id: string) => db.categories.update(id, { type: 'income' });

    it('ignores a keyword pointing to it', async () => {
        await addUserKeywordRule({ keyword: 'barrio', categoryId: 'rest' });
        await moveToIncome('rest');

        expect(await matchUserKeywordRules('Compra del barrio', 'expense')).toEqual([]);
    });

    it('ignores a learned description pointing to it', async () => {
        await learnCategoryForDescription({
            description: 'Compra del barrio',
            type: 'expense',
            categoryId: 'rest',
            categoryPath: 'Gastos diarios › Restaurantes',
        });
        await moveToIncome('rest');

        expect(await getValidatedSuggestion('Compra del barrio', 'expense')).toBeUndefined();
    });

    it('ignores an exact past description pointing to it', async () => {
        await db.transactions.add(tx('t-1', 'Xyzqwk', 'rest', 1_000));
        await moveToIncome('rest');

        expect(await suggestCategory('Xyzqwk', 'expense')).toBeNull();
    });

    it('ignores a similar past description pointing to it', async () => {
        await db.transactions.add(tx('t-1', 'Xyzqwk abono mensual', 'rest', 1_000));
        await moveToIncome('rest');

        expect(await suggestCategory('Xyzqwk abono', 'expense')).toBeNull();
    });

    it('ignores a known merchant learned from it', async () => {
        await db.transactions.add(tx('t-1', 'Pedido tostao centro', 'rest', 1_000));
        await moveToIncome('rest');

        expect((await suggestCategory('Tostao norte', 'expense'))?.categoryId).not.toBe('rest');
    });
});

describe('exact description', () => {
    it('uses the category of the most recent movement by date, not by id', async () => {
        await db.transactions.bulkAdd([
            tx('a-newest', 'Supermercado', 'super', 2_000),
            tx('z-oldest', 'Supermercado', 'rest', 1_000),
        ]);

        const suggestion = await suggestCategory('Supermercado', 'expense');

        expect(suggestion?.categoryId).toBe('super');
        expect(suggestion?.matchKind).toBe('exact');
    });

    it('still finds it behind more than 200 newer movements', async () => {
        await db.transactions.bulkAdd([
            tx('0-old', 'Compra del barrio', 'super', 1_000),
            ...Array.from({ length: 205 }, (_, i) => tx(`z-${i}`, `Movimiento ${i}`, 'rest', 5_000 + i)),
        ]);

        expect((await suggestCategory('Compra del barrio', 'expense'))?.matchKind).toBe('exact');
    });

    it('ignores accents, case and surrounding spaces', async () => {
        await db.transactions.add(tx('t-1', 'Pago préstamo', 'debt-personal', 1_000));

        const suggestion = await suggestCategory('  PAGO PRESTAMO ', 'expense');

        expect(suggestion?.categoryId).toBe('debt-personal');
    });

    it('does not learn from reconciliation adjustments', async () => {
        await db.transactions.bulkAdd([
            tx('t-1', 'Compra del barrio', 'super', 1_000),
            tx('t-2', 'Compra del barrio', 'rest', 2_000, { isAdjustment: true }),
        ]);

        expect((await suggestCategory('Compra del barrio', 'expense'))?.categoryId).toBe('super');
    });

    it('does not suggest a category that was deleted', async () => {
        await db.transactions.add(tx('t-1', 'Compra del barrio', 'rest', 1_000));
        await db.categories.update('rest', { isActive: false });

        expect((await suggestCategory('Compra del barrio', 'expense'))?.categoryId).not.toBe('rest');
    });

    it('wins over a keyword', async () => {
        await db.transactions.add(tx('t-1', 'Compra del barrio', 'rest', 1_000));
        await addUserKeywordRule({ keyword: 'barrio', categoryId: 'super' });

        expect((await suggestCategory('Compra del barrio', 'expense'))?.categoryId).toBe('rest');
    });
});

describe('user keywords', () => {
    it('suggests the keyword category when the description contains it', async () => {
        await addUserKeywordRule({ keyword: 'Transporte', categoryId: 'public' });

        const suggestion = await suggestCategory('Pago de transporte', 'expense');

        expect(suggestion?.categoryId).toBe('public');
        expect(suggestion?.categoryPath).toBe('Transporte › Transporte público');
        expect(suggestion?.matchKind).toBe('keyword');
    });

    it('matches whole words only', async () => {
        await addUserKeywordRule({ keyword: 'gas', categoryId: 'super' });

        expect(await matchUserKeywordRules('Gasolina', 'expense')).toEqual([]);
        expect(await matchUserKeywordRules('Recibo de gas', 'expense')).toHaveLength(1);
    });

    it('prefers the longest keyword', async () => {
        await addUserKeywordRule({ keyword: 'prestamo', categoryId: 'debt-personal' });
        await addUserKeywordRule({ keyword: 'prestamo estudio', categoryId: 'debt-student' });

        expect((await suggestCategory('Abono préstamo estudio', 'expense'))?.categoryId).toBe('debt-student');
    });

    it('offers both categories when keywords of the same length tie', async () => {
        await addUserKeywordRule({ keyword: 'taxi', categoryId: 'private' });
        await addUserKeywordRule({ keyword: 'moto', categoryId: 'public' });

        const suggestion = await suggestCategory('Taxi y moto', 'expense');

        const ids = [suggestion?.categoryId, ...(suggestion?.alternatives ?? []).map((a) => a.categoryId)];
        expect(ids.sort()).toEqual(['private', 'public']);
        expect(suggestion?.confidence).toBeLessThan(0.7);
    });

    it('skips a keyword whose category was deleted', async () => {
        await addUserKeywordRule({ keyword: 'barrio', categoryId: 'rest' });
        await db.categories.update('rest', { isActive: false });

        expect(await matchUserKeywordRules('Compra del barrio', 'expense')).toEqual([]);
    });

    it('keeps income and expense keywords apart', async () => {
        await addUserKeywordRule({ keyword: 'empresa', categoryId: 'payroll' });

        expect(await matchUserKeywordRules('Pago empresa', 'expense')).toEqual([]);
        expect(await matchUserKeywordRules('Pago empresa', 'income')).toHaveLength(1);
    });
});

describe('keyword rule storage', () => {
    it('normalizes accents, case and inner spaces', () => {
        expect(normalizeKeyword('  Préstamo   Banco ')).toBe('prestamo banco');
    });

    it('takes the type from the category and replaces a repeated keyword', async () => {
        await addUserKeywordRule({ keyword: 'barrio', categoryId: 'super' });
        await addUserKeywordRule({ keyword: 'BARRIO', categoryId: 'rest' });

        const rules = await db.userKeywordRules.toArray();
        expect(rules).toHaveLength(1);
        expect(rules[0]).toMatchObject({ type: 'expense', keyword: 'barrio', categoryId: 'rest' });
    });

    it('rejects keywords shorter than three characters', async () => {
        await expect(addUserKeywordRule({ keyword: ' a ', categoryId: 'super' })).rejects.toThrow();
        expect(await db.userKeywordRules.count()).toBe(0);
    });

    it('rejects a parent category that has subcategories', async () => {
        await expect(addUserKeywordRule({ keyword: 'barrio', categoryId: 'daily' })).rejects.toThrow();
    });

    it('deletes a rule', async () => {
        await addUserKeywordRule({ keyword: 'barrio', categoryId: 'super' });
        await deleteUserKeywordRule('expense:barrio');

        expect(await db.userKeywordRules.count()).toBe(0);
    });
});

describe('suggestions that need a choice', () => {
    it('asks for a subcategory instead of proposing a parent the selector does not list', async () => {
        const suggestion = await suggestCategory('Pago préstamo', 'expense');

        expect(suggestion?.categoryId).toBeNull();
        expect(suggestion?.requiresSubcategory).toBe(true);
        expect(suggestion?.categoryPath).toBe('Deuda');
        expect(suggestion?.alternatives?.map((a) => a.categoryId).sort()).toEqual([
            'debt-card',
            'debt-personal',
            'debt-student',
        ]);
    });

    it('shows at most three options for an ambiguous word, all of them selectable', async () => {
        const suggestion = await suggestCategory('Transporte', 'expense');
        const ids = [suggestion?.categoryId, ...(suggestion?.alternatives ?? []).map((a) => a.categoryId)];

        expect(suggestion?.confidence).toBeLessThan(0.7);
        expect(ids.length).toBeGreaterThan(1);
        expect(ids.length).toBeLessThanOrEqual(3);
        expect(ids).not.toContain('transport');
    });

    it('resolves a plain "supermercado" to its subcategory', async () => {
        expect((await suggestCategory('Supermercado', 'expense'))?.categoryId).toBe('super');
    });
});

describe('nothing to suggest', () => {
    it('returns null without a match', async () => {
        expect(await suggestCategory('Xyzqwk', 'expense')).toBeNull();
    });

    it.each(['', '  ', ' a '])('returns null for the description %j', async (description) => {
        await db.transactions.add(tx('t-1', '', 'super', 1_000));

        expect(await suggestCategory(description, 'expense')).toBeNull();
    });

    it('does not match old movements without a description', async () => {
        await db.transactions.add(tx('t-1', '', 'super', 1_000));

        expect(await suggestCategory('Xyzqwk', 'expense')).toBeNull();
    });
});

describe('learned descriptions', () => {
    const learn = { type: 'expense' as const, categoryId: 'super', categoryPath: 'Gastos diarios › Supermercado' };

    it('stores the confirmed category and replaces the previous one', async () => {
        await learnCategoryForDescription({ description: 'Compra del barrio', ...learn });
        await learnCategoryForDescription({ description: 'compra del barrio', ...learn, categoryId: 'rest' });

        expect(await db.suggestionValidations.count()).toBe(1);
        expect((await getValidatedSuggestion('Compra del barrio', 'expense'))?.categoryId).toBe('rest');
    });

    it.each(['', '   ', 'ab'])('learns nothing from the description %j', async (description) => {
        await learnCategoryForDescription({ description, ...learn });

        expect(await db.suggestionValidations.count()).toBe(0);
    });

    const saved = (categoryId: string | null) => ({
        description: 'Compra del barrio',
        type: 'expense' as const,
        suggestion: { categoryId, categoryPath: 'Ruta', confidence: 1, reason: 'x', needsCategoryCreation: categoryId === null },
        chosenSource: 'local' as const,
    });

    it('ignores a learned category that was deleted', async () => {
        await saveValidatedSuggestion(saved('rest'));
        await db.categories.update('rest', { isActive: false });

        expect(await getValidatedSuggestion('Compra del barrio', 'expense')).toBeUndefined();
    });

    it('ignores a learned parent that has subcategories', async () => {
        await saveValidatedSuggestion(saved('debt'));

        expect(await getValidatedSuggestion('Compra del barrio', 'expense')).toBeUndefined();
    });

    it('keeps a validated proposal whose category does not exist yet', async () => {
        await saveValidatedSuggestion(saved(null));

        expect(await getValidatedSuggestion('Compra del barrio', 'expense')).toBeDefined();
    });

    it('deletes a learned description', async () => {
        await learnCategoryForDescription({ description: 'Compra del barrio', ...learn });
        await deleteValidatedSuggestion('expense:compra del barrio');

        expect(await db.suggestionValidations.count()).toBe(0);
    });
});
