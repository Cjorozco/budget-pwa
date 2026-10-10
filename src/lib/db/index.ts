import Dexie, { type EntityTable } from 'dexie';
import { roundMoney } from '../money';
import {
    type Transaction,
    type Account,
    type Reconciliation,
    type Category,
    type Tag,
    type Reserve,
    type AppConfig,
    type QuickTemplate,
    type BudgetItem,
} from '../types';

// Database definition
export class PersonalBudgetDB extends Dexie {
    transactions!: EntityTable<Transaction, 'id'>;
    accounts!: EntityTable<Account, 'id'>;
    reconciliations!: EntityTable<Reconciliation, 'id'>;
    categories!: EntityTable<Category, 'id'>;
    tags!: EntityTable<Tag, 'id'>;
    reserves!: EntityTable<Reserve, 'id'>;
    appConfig!: EntityTable<AppConfig, 'id'>;
    quickTemplates!: EntityTable<QuickTemplate, 'id'>;
    budgetItems!: EntityTable<BudgetItem, 'id'>;

    constructor() {
        super('PersonalBudgetDB');

        // Schema definition
        // Only indexed fields need to be specified here.
        this.version(1).stores({
            transactions: 'id, date, categoryId, accountId, type, isAmbiguous, needsReview',
            accounts: 'id, isActive',
            reconciliations: 'id, accountId, date',
            categories: 'id, type, isActive',
            tags: 'id',
            appConfig: 'id'
        });

        this.version(2).stores({
            accounts: 'id, name, isActive', // Added name
        });

        this.version(3).stores({
            categories: 'id, type, isActive, parentId', // Added parentId
        });

        this.version(4).stores({
            transactions: 'id, type, accountId, categoryId, date, createdAt, isAmbiguous, needsReview',
            tags: 'id, name, usageCount, createdAt',
        });

        this.version(5).stores({
            reserves: 'id, accountId, isActive, createdAt',
        });

        this.version(6).stores({
            quickTemplates: 'id, name, type',
        });

        this.version(7).stores({
            transactions: 'id, type, accountId, categoryId, date, createdAt, isAmbiguous, needsReview, transferId',
        });

        this.version(8).stores({
            budgetItems: 'id, type',
        });

        this.version(9).stores({
            budgetItems: 'id, month, type',
        });
    }
}

// Singleton instance
export const db = new PersonalBudgetDB();

/**
 * Balances are sums of plain numbers, so with cents (CAD, USD) 0.1 + 0.2 would be stored as
 * 0.30000000000000004 and reconciliation (which compares balances exactly) would see a phantom
 * difference. Every write of an account balance is rounded to cents here, at the persistence
 * boundary, so no call site can forget. For whole-peso amounts this changes nothing.
 */
const BALANCE_FIELDS = ['calculatedBalance', 'actualBalance'] as const;

db.accounts.hook('creating', (_primKey, account) => {
    for (const field of BALANCE_FIELDS) {
        const value = account[field];
        if (typeof value === 'number') account[field] = roundMoney(value);
    }
});

db.accounts.hook('updating', (modifications) => {
    const rounded: Record<string, number> = {};
    for (const field of BALANCE_FIELDS) {
        const value = (modifications as Record<string, unknown>)[field];
        if (typeof value === 'number' && roundMoney(value) !== value) rounded[field] = roundMoney(value);
    }
    return Object.keys(rounded).length > 0 ? rounded : undefined;
});
