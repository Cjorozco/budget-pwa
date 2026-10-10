import { db } from './index';
import { z } from 'zod';
import { COUNTRIES, CURRENCIES, countryForCurrency, isCountryCode } from '@/lib/region/region';
import { getRegion, useRegionStore } from '@/lib/region/regionStore';
import type {
    Transaction,
    Account,
    Reconciliation,
    Category,
    Tag,
    Reserve,
    AppConfig,
    QuickTemplate,
    BudgetItem,
} from '../types';

// Row-level Zod schemas for backup validation
export const BackupTransactionSchema = z.object({
    id: z.string().min(1),
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z.number(),
    description: z.string(),
    date: z.number(),
    categoryId: z.string(),
    tagIds: z.array(z.string()).default([]),
    accountId: z.string(),
    suggestedCategoryId: z.string().optional(),
    wasCategorySuggestionAccepted: z.boolean().optional(),
    aiConfidence: z.number().optional(),
    isAmbiguous: z.boolean().optional(),
    needsReview: z.boolean().optional(),
    isAdjustment: z.boolean().optional(),
    reconciliationId: z.string().optional(),
    transferId: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
}).passthrough();

export const BackupAccountSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['bank', 'cash', 'credit']),
    calculatedBalance: z.number(),
    actualBalance: z.number().optional(),
    lastReconciliationDate: z.number().optional(),
    currency: z.enum(CURRENCIES).default('COP'),
    isActive: z.boolean().default(true),
}).passthrough();

export const BackupReconciliationSchema = z.object({
    id: z.string().min(1),
    accountId: z.string().min(1),
    date: z.number(),
    calculatedBalance: z.number(),
    declaredBalance: z.number(),
    difference: z.number(),
    notes: z.string().optional(),
    adjustmentTransactionId: z.string().optional(),
}).passthrough();

export const BackupCategorySchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['income', 'expense']),
    color: z.string(),
    icon: z.string().optional(),
    parentId: z.string().optional(),
    usageCount: z.number().default(0),
    isActive: z.boolean().default(true),
}).passthrough();

export const BackupTagSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    color: z.string(),
    usageCount: z.number().default(0),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
}).passthrough();

export const BackupReserveSchema = z.object({
    id: z.string().min(1),
    accountId: z.string().min(1),
    amount: z.number(),
    description: z.string(),
    categoryId: z.string().optional(),
    isActive: z.boolean().default(true),
    fulfilledAt: z.number().optional(),
    fulfilledTransactionId: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
}).passthrough();

export const BackupAppConfigSchema = z.object({
    id: z.literal('singleton'),
    defaultCurrency: z.enum(CURRENCIES).default('COP'),
    country: z.enum(COUNTRIES).optional(),
    minConfidenceThreshold: z.number().optional(),
    enableAISuggestions: z.boolean().optional(),
}).passthrough();

export const BackupQuickTemplateSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    icon: z.string(),
    description: z.string(),
    amount: z.number(),
    type: z.enum(['income', 'expense']),
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
}).passthrough();

export const BackupBudgetItemSchema = z.object({
    id: z.string().min(1),
    month: z.string().optional(),
    name: z.string().min(1),
    amount: z.number(),
    type: z.enum(['income', 'expense']),
    categoryId: z.string().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
}).passthrough();

// Zod schema for backup validation
export const BackupSchema = z.object({
    version: z.number(),
    timestamp: z.number(),
    tables: z.object({
        transactions: z.array(BackupTransactionSchema),
        accounts: z.array(BackupAccountSchema),
        reconciliations: z.array(BackupReconciliationSchema),
        categories: z.array(BackupCategorySchema),
        tags: z.array(BackupTagSchema),
        reserves: z.array(BackupReserveSchema),
        appConfig: z.array(BackupAppConfigSchema),
        quickTemplates: z.array(BackupQuickTemplateSchema).optional().default([]),
        budgetItems: z.array(BackupBudgetItemSchema).optional().default([]),
    })
}).superRefine((data, ctx) => {
    // Balances are summed, so one backup must use a single currency (the app's currency).
    const appCurrency = data.tables.appConfig[0]?.defaultCurrency;
    const accountCurrencies = new Set(data.tables.accounts.map((a) => a.currency));
    const expected = appCurrency ?? [...accountCurrencies][0];
    if (accountCurrencies.size > 1 || (expected && [...accountCurrencies].some((c) => c !== expected))) {
        ctx.addIssue({
            code: 'custom',
            path: ['tables', 'accounts', 'currency'],
            message: 'Las cuentas del respaldo usan monedas distintas',
        });
    }
});

export interface BackupData {
    version: number;
    timestamp: number;
    tables: {
        transactions: Transaction[];
        accounts: Account[];
        reconciliations: Reconciliation[];
        categories: Category[];
        tags: Tag[];
        reserves: Reserve[];
        appConfig: AppConfig[];
        quickTemplates?: QuickTemplate[];
        budgetItems?: BudgetItem[];
    };
}

export async function exportDatabase(): Promise<string> {
    // Do not include Gemini API keys: they live in localStorage, not Dexie.
    const data: BackupData = {
        version: 1,
        timestamp: Date.now(),
        tables: {
            transactions: await db.transactions.toArray(),
            accounts: await db.accounts.toArray(),
            reconciliations: await db.reconciliations.toArray(),
            categories: await db.categories.toArray(),
            tags: await db.tags.toArray(),
            reserves: await db.reserves.toArray(),
            // The backup carries the region so it restores with the right currency and number format.
            appConfig: (await db.appConfig.toArray()).map((config) => ({ ...config, country: getRegion().country })),
            quickTemplates: await db.quickTemplates.toArray(),
            budgetItems: await db.budgetItems.toArray(),
        }
    };

    return JSON.stringify(data, null, 2);
}

export async function importDatabase(jsonString: string): Promise<void> {
    let rawData: unknown;
    try {
        rawData = JSON.parse(jsonString);
    } catch {
        throw new Error('El archivo no es un JSON válido');
    }

    // Robust Validation with Zod
    const result = BackupSchema.safeParse(rawData);
    if (!result.success) {
        console.error('Validation errors:', result.error.format());
        const missing = result.error.issues.map(i => i.path.join('.')).join(', ');
        throw new Error(`El archivo de respaldo tiene un formato inválido o incompleto: ${missing}`);
    }

    // Row schemas are lenient (legacy backups may lack timestamps); rows are validated above.
    const data = result.data;

    await db.transaction('rw', [
        db.transactions,
        db.accounts,
        db.reconciliations,
        db.categories,
        db.tags,
        db.reserves,
        db.appConfig,
        db.quickTemplates,
        db.budgetItems
    ], async () => {
        try {
            await Promise.all([
                db.transactions.clear(),
                db.accounts.clear(),
                db.reconciliations.clear(),
                db.categories.clear(),
                db.tags.clear(),
                db.reserves.clear(),
                db.appConfig.clear(),
                db.quickTemplates.clear(),
                db.budgetItems.clear(),
            ]);

            if (data.tables.transactions.length > 0) await db.transactions.bulkAdd(data.tables.transactions as Transaction[]);
            if (data.tables.accounts.length > 0) await db.accounts.bulkAdd(data.tables.accounts as Account[]);
            if (data.tables.reconciliations.length > 0) await db.reconciliations.bulkAdd(data.tables.reconciliations as Reconciliation[]);
            if (data.tables.categories.length > 0) await db.categories.bulkAdd(data.tables.categories as Category[]);
            if (data.tables.tags.length > 0) await db.tags.bulkAdd(data.tables.tags as Tag[]);
            if (data.tables.reserves.length > 0) await db.reserves.bulkAdd(data.tables.reserves as Reserve[]);
            if (data.tables.appConfig.length > 0) await db.appConfig.bulkAdd(data.tables.appConfig as AppConfig[]);
            if (data.tables.quickTemplates && data.tables.quickTemplates.length > 0) await db.quickTemplates.bulkAdd(data.tables.quickTemplates as QuickTemplate[]);
            if (data.tables.budgetItems && data.tables.budgetItems.length > 0) await db.budgetItems.bulkAdd(data.tables.budgetItems as BudgetItem[]);
        } catch (error) {
            console.error('Error during bulk import:', error);
            throw new Error('Error al insertar los datos en la base de datos local');
        }
    });

    // The restored data defines the region: country from the backup, or the one implied by its currency.
    const config = data.tables.appConfig[0];
    const accountCurrency = data.tables.accounts[0]?.currency;
    const restoredCountry = isCountryCode(config?.country)
        ? config.country
        : countryForCurrency(config?.defaultCurrency ?? accountCurrency ?? 'COP');
    useRegionStore.getState().setCountry(restoredCountry);
}

export function downloadBackup(jsonString: string) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    // Exact format requested: budget-backup-YYYY-MM-DD.json
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const filename = `budget-backup-${year}-${month}-${day}.json`;

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Sanitizes a CSV cell to prevent Formula Injection (CWE-1236).
 * If content begins with =, +, -, @, \t, or \r, prepend a single quote to force spreadsheet apps to treat it as plain text.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    return `"${sanitized.replace(/"/g, '""')}"`;
}

export async function exportToCSV(): Promise<string> {
    const txs = await db.transactions.toArray();
    const categories = await db.categories.toArray();
    const accounts = await db.accounts.toArray();

    const catMap = new Map(categories.map(c => [c.id, c.name]));
    const accMap = new Map(accounts.map(a => [a.id, a.name]));

    const headers = ['Fecha', 'Descripción', 'Monto', 'Tipo', 'Categoría', 'Cuenta'];
    const rows = txs.map(tx => [
        new Date(tx.date).toLocaleDateString(),
        sanitizeCsvCell(tx.description),
        tx.amount,
        tx.type,
        sanitizeCsvCell(catMap.get(tx.categoryId) || 'Sin Categoría'),
        sanitizeCsvCell(accMap.get(tx.accountId) || 'Cuenta Borrada')
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function downloadCSV(csvString: string) {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];

    a.href = url;
    a.download = `movimientos_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

