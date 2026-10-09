/**
 * Demo mode: load realistic sample data and remove it again without touching
 * anything the user created.
 *
 * Demo rows are recognised by an id that starts with DEMO_ID_PREFIX. No Dexie
 * schema change is needed because `id` is the primary key of every table.
 */
import type { z } from 'zod';
import { db } from './index';
import { seedInitialData } from './seed';
import {
    BackupAccountSchema,
    BackupBudgetItemSchema,
    BackupQuickTemplateSchema,
    BackupTransactionSchema,
} from './backup';
import {
    DEMO_CATEGORY_PATHS,
    DEMO_ID_PREFIX,
    buildDemoData,
    signedAmount,
    type DemoCategoryKey,
    type DemoDataset,
} from './demoData';
import { findOrCreateCategory } from '../ai/categoryResolver';
import { useI18nStore } from '../i18n/i18nStore';
import type { SupportedLanguage } from '../i18n/types';

/** True while any demo transaction, budget item or template exists. */
export async function hasDemoData(): Promise<boolean> {
    const [transactions, budgetItems, templates] = await Promise.all([
        db.transactions.where('id').startsWith(DEMO_ID_PREFIX).count(),
        db.budgetItems.where('id').startsWith(DEMO_ID_PREFIX).count(),
        db.quickTemplates.where('id').startsWith(DEMO_ID_PREFIX).count(),
    ]);
    return transactions + budgetItems + templates > 0;
}

function assertValid(schema: z.ZodType, rows: unknown[], table: string): void {
    for (const row of rows) {
        const result = schema.safeParse(row);
        if (!result.success) {
            const id = (row as { id?: string }).id ?? '?';
            throw new Error(`Invalid demo row in ${table} (${id}): ${result.error.message}`);
        }
    }
}

/** Validates the dataset with the same row schemas the JSON import uses. */
export function validateDemoDataset(data: DemoDataset): void {
    assertValid(BackupAccountSchema, data.accounts, 'accounts');
    assertValid(BackupTransactionSchema, data.transactions, 'transactions');
    assertValid(BackupBudgetItemSchema, data.budgetItems, 'budgetItems');
    assertValid(BackupQuickTemplateSchema, data.quickTemplates, 'quickTemplates');
}

async function recomputeBalance(accountId: string): Promise<void> {
    const history = await db.transactions.where('accountId').equals(accountId).toArray();
    await db.accounts.update(accountId, {
        calculatedBalance: history.reduce((sum, tx) => sum + signedAmount(tx), 0),
    });
}

export interface SeedDemoResult {
    created: boolean;
    transactions: number;
}

/** Idempotent: if demo data is already present it does nothing. */
export async function seedDemoData(
    language: SupportedLanguage = useI18nStore.getState().language,
): Promise<SeedDemoResult> {
    if (await hasDemoData()) return { created: false, transactions: 0 };

    // Make sure the default categories exist before resolving them; otherwise the
    // startup seeder would later skip the catalog because categories are non-empty.
    await seedInitialData();

    const keys = Object.keys(DEMO_CATEGORY_PATHS) as DemoCategoryKey[];
    const ids = await Promise.all(
        keys.map((key) => {
            const { type, parent, sub } = DEMO_CATEGORY_PATHS[key];
            return findOrCreateCategory(type, parent, sub);
        }),
    );
    const categories = Object.fromEntries(keys.map((key, i) => [key, ids[i]])) as Record<DemoCategoryKey, string>;

    const data = buildDemoData({ language, categories });
    validateDemoDataset(data);

    let created = false;
    await db.transaction('rw', [db.transactions, db.accounts, db.budgetItems, db.quickTemplates], async () => {
        // Re-check inside the transaction so two concurrent calls cannot both write.
        if (await hasDemoData()) return;

        const existing = new Set((await db.accounts.bulkGet(data.accounts.map((a) => a.id))).flatMap((a) => (a ? [a.id] : [])));
        await db.accounts.bulkAdd(data.accounts.filter((a) => !existing.has(a.id)));
        await db.transactions.bulkPut(data.transactions);
        await db.budgetItems.bulkPut(data.budgetItems);
        await db.quickTemplates.bulkPut(data.quickTemplates);

        // Balance is derived from history, which also covers a demo account that
        // survived an earlier clear because the user had added their own entries.
        for (const account of data.accounts) await recomputeBalance(account.id);
        created = true;
    });

    return { created, transactions: created ? data.transactions.length : 0 };
}

export interface ClearDemoResult {
    transactions: number;
    accounts: number;
}

/**
 * Removes only rows whose id carries the demo prefix. A demo account is kept
 * (with its balance recomputed) if the user attached anything to it afterwards.
 */
export async function clearDemoData(): Promise<ClearDemoResult> {
    const result: ClearDemoResult = { transactions: 0, accounts: 0 };

    await db.transaction(
        'rw',
        [db.transactions, db.accounts, db.budgetItems, db.quickTemplates, db.reserves, db.reconciliations],
        async () => {
            const demoTxIds = await db.transactions.where('id').startsWith(DEMO_ID_PREFIX).primaryKeys();
            await db.transactions.bulkDelete(demoTxIds);
            result.transactions = demoTxIds.length;

            await db.budgetItems.where('id').startsWith(DEMO_ID_PREFIX).delete();
            await db.quickTemplates.where('id').startsWith(DEMO_ID_PREFIX).delete();

            const demoAccountIds = await db.accounts.where('id').startsWith(DEMO_ID_PREFIX).primaryKeys();
            for (const id of demoAccountIds) {
                const [userTxs, reserves, reconciliations] = await Promise.all([
                    db.transactions.where('accountId').equals(id).count(),
                    db.reserves.where('accountId').equals(id).count(),
                    db.reconciliations.where('accountId').equals(id).count(),
                ]);
                if (userTxs + reserves + reconciliations > 0) {
                    await recomputeBalance(id);
                } else {
                    await db.accounts.delete(id);
                    result.accounts += 1;
                }
            }
        },
    );

    return result;
}
