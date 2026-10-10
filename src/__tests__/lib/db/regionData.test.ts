import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { exportDatabase, importDatabase, BackupSchema } from '@/lib/db/backup';
import { seedInitialData } from '@/lib/db/seed';
import { getRegion, useRegionStore } from '@/lib/region/regionStore';
import { useI18nStore } from '@/lib/i18n/i18nStore';
import type { Account } from '@/lib/types';

const account = (overrides: Partial<Account> = {}): Account => ({
    id: 'acc-1',
    name: 'Cuenta',
    type: 'bank',
    calculatedBalance: 0,
    currency: 'COP',
    isActive: true,
    ...overrides,
});

const clearDb = async () => {
    await Promise.all([
        db.accounts.clear(),
        db.categories.clear(),
        db.appConfig.clear(),
        db.quickTemplates.clear(),
        db.transactions.clear(),
        db.reconciliations.clear(),
        db.tags.clear(),
        db.reserves.clear(),
        db.budgetItems.clear(),
    ]);
};

beforeEach(async () => {
    localStorage.clear();
    useRegionStore.setState({ country: 'CO' });
    useI18nStore.setState({ language: 'es' });
    await clearDb();
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

describe('account balances are stored in exact cents', () => {
    it('rounds on create', async () => {
        await db.accounts.add(account({ currency: 'CAD', calculatedBalance: 0.1 + 0.2, actualBalance: 100.10000000000001 }));
        const stored = await db.accounts.get('acc-1');
        expect(stored?.calculatedBalance).toBe(0.3);
        expect(stored?.actualBalance).toBe(100.1);
    });

    it('rounds on update and on modify, so repeated sums never drift', async () => {
        await db.accounts.add(account({ currency: 'CAD', calculatedBalance: 0.1 }));

        const current = (await db.accounts.get('acc-1'))!;
        await db.accounts.update('acc-1', { calculatedBalance: current.calculatedBalance + 0.2 });
        expect((await db.accounts.get('acc-1'))?.calculatedBalance).toBe(0.3);

        await db.accounts.toCollection().modify((a) => {
            a.calculatedBalance = a.calculatedBalance + 0.1 + 0.2;
        });
        expect((await db.accounts.get('acc-1'))?.calculatedBalance).toBe(0.6);

        // ten additions of 0.1 would normally end at 0.9999999999999999
        for (let i = 0; i < 10; i++) {
            const row = (await db.accounts.get('acc-1'))!;
            await db.accounts.update('acc-1', { calculatedBalance: row.calculatedBalance - 0.06 });
        }
        expect((await db.accounts.get('acc-1'))?.calculatedBalance).toBe(0);
    });

    it('leaves whole-peso balances and unrelated updates untouched', async () => {
        await db.accounts.add(account({ calculatedBalance: 1500000, actualBalance: -50000 }));
        await db.accounts.update('acc-1', { name: 'Renombrada' });
        const stored = await db.accounts.get('acc-1');
        expect(stored).toMatchObject({ name: 'Renombrada', calculatedBalance: 1500000, actualBalance: -50000 });
    });
});

describe('first run seeds by region', () => {
    const setNavigatorLanguage = (language: string) =>
        vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language);

    it('Colombia (default): COP accounts with the historical names', async () => {
        await seedInitialData();
        const accounts = await db.accounts.toArray();
        expect(accounts.map((a) => a.name).sort()).toEqual(['Bancolombia', 'Efectivo']);
        expect(accounts.every((a) => a.currency === 'COP')).toBe(true);
        expect((await db.appConfig.get('singleton'))?.defaultCurrency).toBe('COP');
    });

    it('a Canadian browser gets CAD, Canada and names in its language', async () => {
        setNavigatorLanguage('en-CA');
        await seedInitialData();

        expect(getRegion()).toEqual({ country: 'CA', currency: 'CAD' });
        const accounts = await db.accounts.toArray();
        expect(accounts.map((a) => a.name).sort()).toEqual(['Bank', 'Cash']);
        expect(accounts.every((a) => a.currency === 'CAD')).toBe(true);
        expect(await db.appConfig.get('singleton')).toMatchObject({ defaultCurrency: 'CAD', country: 'CA' });
    });

    it('someone who upgrades with existing data keeps Colombia, even on a Canadian browser', async () => {
        await db.accounts.add(account({ id: 'old', name: 'Mi cuenta' }));
        await db.categories.add({ id: 'c', name: 'Algo', type: 'expense', color: '#000000', usageCount: 0, isActive: true });
        setNavigatorLanguage('en-CA');

        await seedInitialData();

        expect(getRegion().country).toBe('CO');
        expect((await db.accounts.get('old'))?.currency).toBe('COP');
    });
});

describe('backups carry the region', () => {
    const baseTables = {
        transactions: [],
        reconciliations: [],
        categories: [],
        tags: [],
        reserves: [],
    };
    const backup = (accounts: unknown[], appConfig: unknown[]) => ({
        version: 1,
        timestamp: 1,
        tables: { ...baseTables, accounts, appConfig },
    });
    const acc = (currency: string) => ({ id: `a-${currency}`, name: 'Cuenta', type: 'bank', calculatedBalance: 10, currency });

    it('accepts CAD and USD backups and still reads old COP backups without currency info', () => {
        expect(BackupSchema.safeParse(backup([acc('CAD')], [{ id: 'singleton', defaultCurrency: 'CAD' }])).success).toBe(true);
        expect(BackupSchema.safeParse(backup([acc('USD')], [])).success).toBe(true);
        const legacy = backup([{ id: 'a', name: 'Cuenta', type: 'bank', calculatedBalance: 1 }], [{ id: 'singleton' }]);
        const parsed = BackupSchema.safeParse(legacy);
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data.tables.accounts[0].currency).toBe('COP');
    });

    it('rejects unsupported currencies and mixed-currency backups', () => {
        expect(BackupSchema.safeParse(backup([acc('EUR')], [])).success).toBe(false);
        expect(BackupSchema.safeParse(backup([acc('COP'), acc('CAD')], [])).success).toBe(false);
        expect(BackupSchema.safeParse(backup([acc('CAD')], [{ id: 'singleton', defaultCurrency: 'COP' }])).success).toBe(false);
    });

    it('export writes the active country; importing a CAD backup switches the app to Canada', async () => {
        useRegionStore.setState({ country: 'CA' });
        await db.appConfig.add({ id: 'singleton', defaultCurrency: 'CAD', minConfidenceThreshold: 0.7, enableAISuggestions: true });
        await db.accounts.add(account({ currency: 'CAD', calculatedBalance: 12.5 }));

        const exported = JSON.parse(await exportDatabase());
        expect(exported.tables.appConfig[0]).toMatchObject({ defaultCurrency: 'CAD', country: 'CA' });

        useRegionStore.setState({ country: 'CO' });
        await importDatabase(JSON.stringify(exported));

        expect(getRegion()).toEqual({ country: 'CA', currency: 'CAD' });
        expect((await db.accounts.get('acc-1'))?.calculatedBalance).toBe(12.5);
    });

    it('importing an old COP backup keeps (or returns to) Colombia', async () => {
        useRegionStore.setState({ country: 'CA' });
        await importDatabase(JSON.stringify(backup([{ id: 'a', name: 'Cuenta', type: 'bank', calculatedBalance: 1, currency: 'COP' }], [])));
        expect(getRegion().country).toBe('CO');
    });
});
