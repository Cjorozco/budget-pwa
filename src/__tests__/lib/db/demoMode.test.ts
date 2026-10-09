import { beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { seedInitialData } from '@/lib/db/seed';
import { clearDemoData, hasDemoData, seedDemoData, validateDemoDataset } from '@/lib/db/demoMode';
import { BackupSchema } from '@/lib/db/backup';
import { DEMO_CATEGORY_PATHS, DEMO_ID_PREFIX, buildDemoData, signedAmount, type DemoCategoryKey } from '@/lib/db/demoData';
import { TransactionSchema } from '@/lib/schemas';
import type { Transaction } from '@/lib/types';

const REF = new Date(2026, 9, 15, 10, 0, 0);

const fakeCategories = Object.fromEntries(
    (Object.keys(DEMO_CATEGORY_PATHS) as DemoCategoryKey[]).map((k) => [k, `cat-${k}`]),
) as Record<DemoCategoryKey, string>;

async function resetDb() {
    await Promise.all(db.tables.map((t) => t.clear()));
}

function userTx(accountId: string, categoryId: string): Transaction {
    return {
        id: uuidv4(),
        type: 'expense',
        amount: 12_345,
        description: 'User coffee',
        date: Date.now(),
        categoryId,
        tagIds: [],
        accountId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

describe('demo dataset (pure builder)', () => {
    it('is valid against the existing Zod schemas', () => {
        for (const language of ['es', 'en', 'fr'] as const) {
            const data = buildDemoData({ now: REF, language, categories: fakeCategories });
            expect(() => validateDemoDataset(data)).not.toThrow();

            const backup = BackupSchema.safeParse({
                version: 1,
                timestamp: REF.getTime(),
                tables: {
                    transactions: data.transactions,
                    accounts: data.accounts,
                    reconciliations: [],
                    categories: [],
                    tags: [],
                    reserves: [],
                    appConfig: [],
                    quickTemplates: data.quickTemplates,
                    budgetItems: data.budgetItems,
                },
            });
            expect(backup.success).toBe(true);

            // Income/expense rows also satisfy the form-level schema.
            for (const tx of data.transactions.filter((t) => t.type !== 'transfer')) {
                expect(TransactionSchema.safeParse(tx).success, tx.id).toBe(true);
            }
        }
    });

    it('has the requested shape: 3 accounts, 60-90 transactions, transfers, 3 templates, 3 months of budget', () => {
        for (const now of [new Date(2026, 9, 1), REF, new Date(2026, 2, 31), new Date(2026, 4, 1)]) {
            const data = buildDemoData({ now, language: 'es', categories: fakeCategories });
            expect(data.accounts).toHaveLength(3);
            expect(data.transactions.length).toBeGreaterThanOrEqual(60);
            expect(data.transactions.length).toBeLessThanOrEqual(90);
            expect(data.quickTemplates).toHaveLength(3);
            expect(new Set(data.budgetItems.map((b) => b.month)).size).toBe(3);
            expect(new Set(data.transactions.map((t) => t.id)).size).toBe(data.transactions.length);
        }
    });

    it('keeps transfers paired, with the same transferId and opposite sides', () => {
        const { transactions } = buildDemoData({ now: REF, language: 'en', categories: fakeCategories });
        const transfers = transactions.filter((t) => t.type === 'transfer');
        expect(transfers.length).toBeGreaterThanOrEqual(2);
        const byId = new Map<string, Transaction[]>();
        transfers.forEach((t) => byId.set(t.transferId!, [...(byId.get(t.transferId!) ?? []), t]));
        for (const pair of byId.values()) {
            expect(pair).toHaveLength(2);
            expect(pair.map((t) => t.categoryId).sort()).toEqual(['transfer-in', 'transfer-out']);
            expect(pair[0].accountId).not.toBe(pair[1].accountId);
            expect(pair[0].amount).toBe(pair[1].amount);
        }
    });

    it('derives balances from history and never goes negative along the way', () => {
        const data = buildDemoData({ now: REF, language: 'es', categories: fakeCategories });
        const running = new Map<string, number>();
        for (const tx of data.transactions) {
            const next = (running.get(tx.accountId) ?? 0) + signedAmount(tx);
            running.set(tx.accountId, next);
            expect(next, `${tx.id} on ${tx.accountId}`).toBeGreaterThanOrEqual(0);
        }
        for (const account of data.accounts) {
            expect(account.calculatedBalance).toBe(running.get(account.id));
        }
    });

    it('prefixes every id and localizes labels', () => {
        const es = buildDemoData({ now: REF, language: 'es', categories: fakeCategories });
        const en = buildDemoData({ now: REF, language: 'en', categories: fakeCategories });
        const ids = [...es.accounts, ...es.transactions, ...es.budgetItems, ...es.quickTemplates].map((r) => r.id);
        expect(ids.every((id) => id.startsWith(DEMO_ID_PREFIX))).toBe(true);
        expect(es.accounts[0].name).not.toBe(en.accounts[0].name);
        expect(en.budgetItems.some((b) => b.name === 'Rent')).toBe(true);
    });
});

describe('demo mode (database)', () => {
    beforeEach(async () => {
        await resetDb();
        await seedInitialData();
    });

    it('seeds through the validated pipeline with balances matching history', async () => {
        const result = await seedDemoData('es');
        expect(result.created).toBe(true);
        expect(await hasDemoData()).toBe(true);

        const accounts = await db.accounts.where('id').startsWith(DEMO_ID_PREFIX).toArray();
        expect(accounts).toHaveLength(3);
        for (const account of accounts) {
            const history = await db.transactions.where('accountId').equals(account.id).toArray();
            expect(account.calculatedBalance).toBe(history.reduce((s, t) => s + signedAmount(t), 0));
        }

        // Every referenced category exists in the user's catalog.
        const txs = await db.transactions.toArray();
        const categoryIds = new Set((await db.categories.toArray()).map((c) => c.id));
        for (const tx of txs.filter((t) => t.type !== 'transfer')) {
            expect(categoryIds.has(tx.categoryId), tx.id).toBe(true);
        }
    });

    it('does not duplicate data when seeded twice', async () => {
        await seedDemoData('es');
        const counts = async () => [
            await db.transactions.count(),
            await db.accounts.count(),
            await db.categories.count(),
            await db.budgetItems.count(),
            await db.quickTemplates.count(),
        ];
        const first = await counts();

        const second = await seedDemoData('es');
        expect(second.created).toBe(false);
        expect(await counts()).toEqual(first);

        await Promise.all([seedDemoData('es'), seedDemoData('es')]);
        expect(await counts()).toEqual(first);
    });

    it('clear removes demo rows but keeps data the user created after the seed', async () => {
        const userAccountId = uuidv4();
        await db.accounts.add({ id: userAccountId, name: 'My own account', type: 'bank', calculatedBalance: 500, currency: 'COP', isActive: true });
        const defaultAccountsBefore = await db.accounts.count();

        await seedDemoData('en');
        const category = (await db.categories.toArray())[0];
        const mine = userTx(userAccountId, category.id);
        await db.transactions.add(mine);
        await db.budgetItems.add({ id: uuidv4(), month: '2026-10', name: 'My budget', amount: 1, type: 'expense', createdAt: 1 });
        await db.quickTemplates.add({ id: uuidv4(), name: 'Mine', icon: '⭐', description: 'x', amount: 1, type: 'expense', createdAt: 1, updatedAt: 1 });

        const result = await clearDemoData();
        expect(result.transactions).toBeGreaterThan(60);
        expect(await hasDemoData()).toBe(false);

        expect(await db.transactions.toArray()).toEqual([mine]);
        expect((await db.accounts.get(userAccountId))?.calculatedBalance).toBe(500);
        expect(await db.accounts.count()).toBe(defaultAccountsBefore);
        expect(await db.budgetItems.count()).toBe(1);
        // 3 default templates from the startup seeder + the user's one.
        expect(await db.quickTemplates.count()).toBe(4);
        expect(await db.categories.count()).toBeGreaterThan(50);
    });

    it('keeps a demo account that the user already used, with a balance derived from their history', async () => {
        await seedDemoData('es');
        const cash = `${DEMO_ID_PREFIX}acc-cash`;
        const category = (await db.categories.toArray())[0];
        const mine = userTx(cash, category.id);
        await db.transactions.add(mine);

        const result = await clearDemoData();
        expect(result.accounts).toBe(2);
        expect(await db.transactions.toArray()).toEqual([mine]);
        expect((await db.accounts.get(cash))?.calculatedBalance).toBe(-mine.amount);
        expect(await hasDemoData()).toBe(false);

        // Seeding again restores the demo without double-counting the kept account.
        await seedDemoData('es');
        const history = await db.transactions.where('accountId').equals(cash).toArray();
        expect((await db.accounts.get(cash))?.calculatedBalance).toBe(history.reduce((s, t) => s + signedAmount(t), 0));
    });
});

describe('first-run seed (regression)', () => {
    it('seedInitialData populates an empty database without aborting', async () => {
        await resetDb();
        await expect(seedInitialData()).resolves.toBeUndefined();
        expect(await db.categories.count()).toBeGreaterThan(50);
        expect(await db.accounts.count()).toBe(2);
        expect(await db.quickTemplates.count()).toBe(3);
        expect(await db.appConfig.count()).toBe(1);
    });
});
