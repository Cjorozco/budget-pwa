import Dexie, { type EntityTable } from 'dexie';
import {
    type Transaction,
    type Account,
    type Reconciliation,
    type Category,
    type Tag,
    type Reserve,
    type AppConfig,
    type QuickTemplate,
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
    }
}

// Singleton instance
export const db = new PersonalBudgetDB();
