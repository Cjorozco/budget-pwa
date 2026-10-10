import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { exportDatabase, importDatabase } from '@/lib/db/backup';
import { seedInitialData } from '@/lib/db/seed';
import { SEED_NAME_TRANSLATIONS, quickTemplateDefaults, seedNameFor } from '@/lib/db/seedNames';
import { findCategoryByPath, findOrCreateCategory } from '@/lib/ai/categoryResolver';
import { suggestCategory } from '@/lib/ai/categorizer';
import { buildPrompt } from '@/lib/ai/categorizationPrompt';
import { loadCategoryCatalog } from '@/lib/ai/geminiSuggest';
import { useRegionStore } from '@/lib/region/regionStore';
import { useI18nStore } from '@/lib/i18n/i18nStore';
import type { Category } from '@/lib/types';

type Language = 'es' | 'en' | 'fr';
type Country = 'CO' | 'CA' | 'US';

const clearDb = () =>
    Promise.all([
        db.categories.clear(),
        db.accounts.clear(),
        db.appConfig.clear(),
        db.quickTemplates.clear(),
        db.transactions.clear(),
        db.reconciliations.clear(),
        db.tags.clear(),
        db.reserves.clear(),
        db.budgetItems.clear(),
    ]);

/** Seeds an empty database as the first run of someone in `country` using `language`. */
async function seedAs(country: Country, language: Language) {
    await clearDb();
    useRegionStore.setState({ country });
    useI18nStore.setState({ language });
    // an explicit region is already stored, so the first run keeps it
    localStorage.setItem('budget_region', JSON.stringify({ country }));
    await seedInitialData();
}

const pathOf = (category: Category, all: Category[]) => {
    const parent = category.parentId ? all.find((c) => c.id === category.parentId) : undefined;
    return parent ? `${parent.name} › ${category.name}` : category.name;
};

beforeEach(async () => {
    localStorage.clear();
    await clearDb();
});

afterEach(() => {
    localStorage.clear();
    useRegionStore.setState({ country: 'CO' });
    useI18nStore.setState({ language: 'es' });
});

describe('seeded categories by language', () => {
    it('Spanish: the names are exactly the ones the app always seeded, plus a canonical key', async () => {
        await seedAs('CO', 'es');
        const all = await db.categories.toArray();

        expect(all).toHaveLength(121);
        expect(new Set(all.map((c) => c.name)).size).toBe(96);
        expect(all.every((c) => c.seedKey !== undefined)).toBe(true);
        // in Spanish the key is the path of the category itself
        for (const category of all) expect(category.seedKey).toBe(pathOf(category, all));
        expect(all.find((c) => c.seedKey === 'Gastos diarios › Supermercado')?.name).toBe('Supermercado');
    });

    it('has an English and a French name for every seeded category', async () => {
        await seedAs('CO', 'es');
        const names = new Set((await db.categories.toArray()).map((c) => c.name));
        const missing = [...names].filter((name) => !SEED_NAME_TRANSLATIONS[name]);
        expect(missing).toEqual([]);
        for (const [name, translation] of Object.entries(SEED_NAME_TRANSLATIONS)) {
            expect(translation.en.trim(), `${name} (en)`).not.toBe('');
            expect(translation.fr.trim(), `${name} (fr)`).not.toBe('');
        }
    });

    it.each([
        ['en', 'Daily expenses › Groceries'],
        ['fr', 'Dépenses quotidiennes › Épicerie'],
    ] as const)('%s: names are translated, structure and keys are the same as in Spanish', async (language, groceries) => {
        await seedAs('CA', 'es');
        const spanish = await db.categories.toArray();

        await seedAs('CA', language);
        const translated = await db.categories.toArray();

        expect(translated).toHaveLength(spanish.length);
        expect(translated.map((c) => c.seedKey).sort()).toEqual(spanish.map((c) => c.seedKey).sort());
        const supermarket = translated.find((c) => c.seedKey === 'Gastos diarios › Supermercado')!;
        expect(pathOf(supermarket, translated)).toBe(groceries);

        // translated siblings must stay distinguishable
        const siblingNames = new Map<string, string[]>();
        for (const c of translated) {
            const key = `${c.type}|${c.parentId ?? 'root'}`;
            siblingNames.set(key, [...(siblingNames.get(key) ?? []), c.name]);
        }
        for (const [key, names] of siblingNames) expect(new Set(names).size, key).toBe(names.length);
    });

    it('does not translate by accident: unknown names stay as they are', () => {
        expect(seedNameFor('Natación', 'en')).toBe('Natación');
        expect(seedNameFor('Supermercado', 'es')).toBe('Supermercado');
        expect(seedNameFor('Supermercado', 'en')).toBe('Groceries');
    });
});

describe('quick templates follow language and currency', () => {
    it('Colombia / Spanish keeps the historical templates and amounts', async () => {
        await seedAs('CO', 'es');
        const templates = (await db.quickTemplates.toArray()).sort((a, b) => b.amount - a.amount);
        expect(templates.map((t) => [t.name, t.amount])).toEqual([
            ['Supermercado', 50000],
            ['Almuerzo', 20000],
            ['Transporte', 15000],
        ]);
    });

    it('Canada gets names in its language and amounts in dollars, not pesos', async () => {
        await seedAs('CA', 'en');
        const templates = (await db.quickTemplates.toArray()).sort((a, b) => b.amount - a.amount);
        expect(templates.map((t) => [t.name, t.amount])).toEqual([
            ['Groceries', 100],
            ['Lunch', 15],
            ['Transportation', 6],
        ]);
        expect(quickTemplateDefaults('fr', 'CAD')[0].name).toBe('Épicerie');
        expect(quickTemplateDefaults('es', 'USD')[0].amount).toBe(100);
    });
});

describe('lookups work through the canonical key', () => {
    beforeEach(() => seedAs('CA', 'en'));

    it('finds a default category by its Spanish path even though it is called Groceries', async () => {
        const found = await findCategoryByPath('expense', 'Gastos diarios', 'Supermercado');
        expect(found?.name).toBe('Groceries');
        const root = await findCategoryByPath('expense', 'Gastos diarios');
        expect(root?.name).toBe('Daily expenses');
    });

    it('still finds categories by the name the user sees', async () => {
        expect((await findCategoryByPath('expense', 'Daily expenses', 'Groceries'))?.seedKey).toBe('Gastos diarios › Supermercado');
    });

    it('creates a missing rule target in the user language under the existing translated parent, once', async () => {
        const rootsBefore = (await db.categories.filter((c) => !c.parentId && c.type === 'expense').toArray()).length;

        const id = await findOrCreateCategory('expense', 'Gastos diarios', 'Café');
        const created = (await db.categories.get(id))!;
        const parent = (await db.categories.get(created.parentId!))!;

        expect(created).toMatchObject({ name: 'Coffee', seedKey: 'Gastos diarios › Café' });
        expect(parent.name).toBe('Daily expenses');
        expect((await db.categories.filter((c) => !c.parentId && c.type === 'expense').toArray()).length).toBe(rootsBefore);
        // the next suggestion finds it instead of proposing to create it again
        expect(await findOrCreateCategory('expense', 'Gastos diarios', 'Café')).toBe(id);
        expect((await findCategoryByPath('expense', 'Gastos diarios', 'Café'))?.id).toBe(id);
    });

    it('creates a whole missing branch in English with canonical keys', async () => {
        const id = await findOrCreateCategory('expense', 'Gastos financieros', 'Impuestos');
        const child = (await db.categories.get(id))!;
        const root = (await db.categories.get(child.parentId!))!;
        expect(root).toMatchObject({ name: 'Financial expenses', seedKey: 'Gastos financieros' });
        expect(child).toMatchObject({ name: 'Taxes', seedKey: 'Gastos financieros › Impuestos' });
        expect(await findOrCreateCategory('expense', 'Gastos financieros', 'Impuestos')).toBe(id);
    });

    it('creates AI proposals exactly as given, without keys', async () => {
        const id = await findOrCreateCategory('expense', 'Daily expenses', 'Swimming lessons');
        const created = (await db.categories.get(id))!;
        expect(created.name).toBe('Swimming lessons');
        expect(created.seedKey).toBeUndefined();
        expect((await db.categories.get(created.parentId!))?.name).toBe('Daily expenses');
    });

    it('Spanish users get no keys on new categories and no behavior change', async () => {
        await seedAs('CO', 'es');
        const id = await findOrCreateCategory('expense', 'Gastos diarios', 'Café');
        expect(await db.categories.get(id)).toMatchObject({ name: 'Café' });
        expect((await db.categories.get(id))?.seedKey).toBeUndefined();
    });
});

describe('local engine and AI prompt with translated categories', () => {
    it.each([
        ['en', 'Daily expenses › Restaurants'],
        ['fr', 'Dépenses quotidiennes › Restaurants'],
    ] as const)('%s: a Canadian rule resolves to the existing translated category', async (language, expected) => {
        await seedAs('CA', language);
        const suggestion = await suggestCategory('Tim Hortons', 'expense');
        expect(suggestion?.categoryPath).toBe(expected);
        expect(suggestion?.needsCategoryCreation).toBe(false);
        expect(suggestion?.categoryId).not.toBeNull();
    });

    it('the prompt catalog keeps the criteria and names the user categories in their notes', async () => {
        await seedAs('CA', 'en');
        const catalog = await loadCategoryCatalog('expense');
        const clothing = catalog.find((row) => row.canonicalPath === 'Gastos diarios › Ropa')!;
        expect(clothing.path).toBe('Daily expenses › Clothing');

        const prompt = buildPrompt('new shirt', 'expense', catalog);
        const line = prompt.split('\n').find((l) => l.startsWith(`- ${clothing.id}`))!;
        expect(line).toContain('cubre: ropa y calzado del propio usuario');
        // the reference to the kids' clothing category uses the name the user has
        expect(line).toContain('Kids › Clothing');
        expect(line).not.toContain('Niños');

        const transport = prompt.split('\n').find((l) => l.includes('| Transportation (raíz)'))!;
        expect(transport).toContain('(Travel)');
        expect(transport).toContain('Kids › Transportation');
        expect(transport).not.toContain('Viajes');
    });

    it('the Spanish prompt is untouched', async () => {
        await seedAs('CO', 'es');
        const prompt = buildPrompt('camisa', 'expense', await loadCategoryCatalog('expense'));
        expect(prompt).toContain('no: ropa de los niños (Niños › Ropa)');
    });
});

describe('backups keep the canonical keys', () => {
    it('exports and restores seedKey', async () => {
        await seedAs('CA', 'fr');
        const before = (await db.categories.toArray()).map((c) => [c.name, c.seedKey]).sort();

        const json = await exportDatabase();
        await importDatabase(json);

        const after = (await db.categories.toArray()).map((c) => [c.name, c.seedKey]).sort();
        expect(after).toEqual(before);
        expect(after.some(([name, key]) => name === 'Épicerie' && key === 'Gastos diarios › Supermercado')).toBe(true);
    });
});
