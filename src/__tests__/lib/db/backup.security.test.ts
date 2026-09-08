import { describe, expect, it } from 'vitest';
import { sanitizeCsvCell, BackupSchema, importDatabase } from '@/lib/db/backup';

describe('backup security: CSV formula injection (CWE-1236)', () => {
    it('prepends single quote to cells starting with dangerous characters', () => {
        expect(sanitizeCsvCell('=cmd|"/C calc"!A0')).toBe(`"'=cmd|""/C calc""!A0"`);
        expect(sanitizeCsvCell('+12345')).toBe(`"'+12345"`);
        expect(sanitizeCsvCell('-50000')).toBe(`"'-50000"`);
        expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe(`"'@SUM(A1:A10)"`);
        expect(sanitizeCsvCell('\tTabbedValue')).toBe(`"'\tTabbedValue"`);
    });

    it('leaves standard text and numbers untouched', () => {
        expect(sanitizeCsvCell('Compra en supermercado')).toBe(`"Compra en supermercado"`);
        expect(sanitizeCsvCell(12500)).toBe(`"12500"`);
        expect(sanitizeCsvCell(null)).toBe(`""`);
        expect(sanitizeCsvCell(undefined)).toBe(`""`);
    });
});

describe('backup security: row-level schema validation', () => {
    it('rejects backup with invalid transaction rows', () => {
        const invalidBackup = {
            version: 1,
            timestamp: Date.now(),
            tables: {
                transactions: [
                    {
                        id: 'tx-1',
                        type: 'invalid_type', // not income, expense or transfer
                        amount: 'not-a-number',
                        description: 'Fail',
                        date: Date.now(),
                        categoryId: 'cat-1',
                        accountId: 'acc-1',
                    },
                ],
                accounts: [],
                reconciliations: [],
                categories: [],
                tags: [],
                reserves: [],
                appConfig: [],
            },
        };

        const result = BackupSchema.safeParse(invalidBackup);
        expect(result.success).toBe(false);
    });

    it('rejects importDatabase with malformed transaction payload', async () => {
        const malformedJson = JSON.stringify({
            version: 1,
            timestamp: Date.now(),
            tables: {
                transactions: [{ id: '', amount: 'free' }],
                accounts: [],
                reconciliations: [],
                categories: [],
                tags: [],
                reserves: [],
                appConfig: [],
            },
        });

        await expect(importDatabase(malformedJson)).rejects.toThrow(
            /formato inválido o incompleto/i
        );
    });
});
