export interface Transaction {
    id: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    description: string;
    date: number; // timestamp
    categoryId: string; // 1 mandatory
    tagIds: string[]; // 0..n
    accountId: string; // MANDATORY
    suggestedCategoryId?: string;
    wasCategorySuggestionAccepted?: boolean;
    aiConfidence?: number; // 0–1
    isAmbiguous?: boolean; // aiConfidence < threshold
    needsReview?: boolean;
    isAdjustment?: boolean;
    reconciliationId?: string;
    transferId?: string; // Links two transactions (source and destination)
    createdAt: number;
    updatedAt: number;
}

export interface Account {
    id: string;
    name: string;
    type: 'bank' | 'cash' | 'credit';
    calculatedBalance: number;
    actualBalance?: number;
    lastReconciliationDate?: number;
    currency: 'COP';
    isActive: boolean;
}

export interface Reconciliation {
    id: string;
    accountId: string;
    date: number;
    calculatedBalance: number;
    declaredBalance: number;
    difference: number;
    notes?: string;
    adjustmentTransactionId?: string;
}

export interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
    color: string;
    icon?: string;
    parentId?: string; // For subcategories
    usageCount: number;
    isActive: boolean;
}

export interface Tag {
    id: string;
    name: string;
    color: string;
    usageCount: number;
    createdAt: number;
    updatedAt: number;
}

export interface Reserve {
    id: string;
    accountId: string;
    amount: number;
    description: string;
    categoryId?: string;
    isActive: boolean;
    fulfilledAt?: number;
    fulfilledTransactionId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface AppConfig {
    id: 'singleton';
    defaultCurrency: 'COP';
    minConfidenceThreshold: number; // 0.7
    enableAISuggestions: boolean;
}

export interface QuickTemplate {
    id: string;
    name: string;
    icon: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    categoryId?: string;
    accountId?: string;
    createdAt: number;
    updatedAt: number;
}
