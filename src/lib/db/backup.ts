import { db } from './index';
import { z } from 'zod';

// Zod schema for backup validation
const BackupSchema = z.object({
    version: z.number(),
    timestamp: z.number(),
    tables: z.object({
        transactions: z.array(z.any()),
        accounts: z.array(z.any()),
        reconciliations: z.array(z.any()),
        categories: z.array(z.any()),
        tags: z.array(z.any()),
        reserves: z.array(z.any()),
        appConfig: z.array(z.any()),
    })
});

export type BackupData = z.infer<typeof BackupSchema>;

export async function exportDatabase(): Promise<string> {
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
            appConfig: await db.appConfig.toArray(),
        }
    };

    return JSON.stringify(data, null, 2);
}

export async function importDatabase(jsonString: string): Promise<void> {
    let rawData: any;
    try {
        rawData = JSON.parse(jsonString);
    } catch (e) {
        throw new Error('El archivo no es un JSON válido');
    }

    // Robust Validation with Zod
    const result = BackupSchema.safeParse(rawData);
    if (!result.success) {
        console.error('Validation errors:', result.error.format());
        const missing = result.error.issues.map(i => i.path.join('.')).join(', ');
        throw new Error(`El archivo de respaldo tiene un formato inválido o incompleto: ${missing}`);
    }

    const data = result.data;

    await db.transaction('rw', [
        db.transactions,
        db.accounts,
        db.reconciliations,
        db.categories,
        db.tags,
        db.reserves,
        db.appConfig
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
            ]);

            if (data.tables.transactions.length > 0) await db.transactions.bulkAdd(data.tables.transactions);
            if (data.tables.accounts.length > 0) await db.accounts.bulkAdd(data.tables.accounts);
            if (data.tables.reconciliations.length > 0) await db.reconciliations.bulkAdd(data.tables.reconciliations);
            if (data.tables.categories.length > 0) await db.categories.bulkAdd(data.tables.categories);
            if (data.tables.tags.length > 0) await db.tags.bulkAdd(data.tables.tags);
            if (data.tables.reserves.length > 0) await db.reserves.bulkAdd(data.tables.reserves);
            if (data.tables.appConfig.length > 0) await db.appConfig.bulkAdd(data.tables.appConfig);
        } catch (error) {
            console.error('Error during bulk import:', error);
            throw new Error('Error al insertar los datos en la base de datos local');
        }
    });
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

export async function exportToCSV(): Promise<string> {
    const txs = await db.transactions.toArray();
    const categories = await db.categories.toArray();
    const accounts = await db.accounts.toArray();

    const catMap = new Map(categories.map(c => [c.id, c.name]));
    const accMap = new Map(accounts.map(a => [a.id, a.name]));

    const headers = ['Fecha', 'Descripción', 'Monto', 'Tipo', 'Categoría', 'Cuenta'];
    const rows = txs.map(tx => [
        new Date(tx.date).toLocaleDateString(),
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.amount,
        tx.type,
        `"${catMap.get(tx.categoryId) || 'Sin Categoría'}"`,
        `"${accMap.get(tx.accountId) || 'Cuenta Borrada'}"`
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
