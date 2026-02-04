import Dexie, { type EntityTable } from 'dexie';
import {
    type Transaction,
    type Account,
    type Reconciliation,
    type Category,
    type Tag,
    type AppConfig,
} from '../types';

// Database definition
export class PersonalBudgetDB extends Dexie {
    transactions!: EntityTable<Transaction, 'id'>;
    accounts!: EntityTable<Account, 'id'>;
    reconciliations!: EntityTable<Reconciliation, 'id'>;
    categories!: EntityTable<Category, 'id'>;
    tags!: EntityTable<Tag, 'id'>;
    appConfig!: EntityTable<AppConfig, 'id'>;

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
    }
}

// Singleton instance
export const db = new PersonalBudgetDB();
