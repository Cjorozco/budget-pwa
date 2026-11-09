import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { exportDatabase, importDatabase } from '@/lib/db/backup';

const rule = { id: 'expense:barrio', type: 'expense' as const, keyword: 'barrio', categoryId: 'cat-1', createdAt: 1 };

describe('backup of user keyword rules', () => {
    beforeEach(async () => {
        await db.userKeywordRules.clear();
    });

    it('restores the rules from an exported backup', async () => {
        await db.userKeywordRules.add(rule);
        const backup = await exportDatabase();
        await db.userKeywordRules.clear();

        await importDatabase(backup);

        expect(await db.userKeywordRules.toArray()).toEqual([rule]);
    });

    it('accepts a backup made before the rules existed', async () => {
        await db.userKeywordRules.add(rule);
        const backup = JSON.parse(await exportDatabase());
        delete backup.tables.userKeywordRules;

        await importDatabase(JSON.stringify(backup));

        expect(await db.userKeywordRules.count()).toBe(0);
    });
});
