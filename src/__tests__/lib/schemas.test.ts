import { describe, it, expect } from 'vitest';

// We import the schemas directly — Zod schemas are self-contained
import { AccountSchema, TransactionSchema } from '@/lib/schemas';

describe('TransactionSchema', () => {
  const validTransaction = {
    amount: 50000,
    description: 'Almuerzo en restaurante',
    categoryId: 'cat-food',
    accountId: 'acc-bank',
    date: Date.now(),
    type: 'expense' as const,
    tagIds: [],
  };

  it('accepts a valid transaction', () => {
    const result = TransactionSchema.safeParse(validTransaction);
    expect(result.success).toBe(true);
  });

  it('rejects amount less than 1', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, amount: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const amountError = result.error.issues.find(i => i.path.includes('amount'));
      expect(amountError).toBeDefined();
    }
  });

  it('rejects negative amount', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, amount: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects description shorter than 3 characters', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, description: 'ab' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const descError = result.error.issues.find(i => i.path.includes('description'));
      expect(descError).toBeDefined();
    }
  });

  it('rejects empty categoryId', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, categoryId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty accountId', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, accountId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, type: 'transfer' });
    expect(result.success).toBe(false);
  });

  it('accepts valid type: income', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, type: 'income' });
    expect(result.success).toBe(true);
  });

  it('defaults tagIds to empty array', () => {
    const { tagIds, ...withoutTags } = validTransaction;
    const result = TransactionSchema.safeParse(withoutTags);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tagIds).toEqual([]);
    }
  });

  it('accepts optional AI metadata fields', () => {
    const result = TransactionSchema.safeParse({
      ...validTransaction,
      suggestedCategoryId: 'cat-food',
      wasCategorySuggestionAccepted: true,
      aiConfidence: 0.85,
      isAmbiguous: false,
      needsReview: false,
    });
    expect(result.success).toBe(true);
  });

  it('defaults date to current timestamp when omitted', () => {
    const { date, ...withoutDate } = validTransaction;
    const before = Date.now();
    const result = TransactionSchema.safeParse(withoutDate);
    const after = Date.now();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBeGreaterThanOrEqual(before);
      expect(result.data.date).toBeLessThanOrEqual(after);
    }
  });
});

describe('AccountSchema', () => {
  const validAccount = {
    name: 'Bancolombia',
    type: 'bank' as const,
    calculatedBalance: 1500000,
    currency: 'COP' as const,
  };

  it('accepts a valid account', () => {
    const result = AccountSchema.safeParse(validAccount);
    expect(result.success).toBe(true);
  });

  it('rejects name shorter than 2 characters', () => {
    const result = AccountSchema.safeParse({ ...validAccount, name: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(i => i.path.includes('name'));
      expect(nameError).toBeDefined();
    }
  });

  it('accepts 2-character name', () => {
    const result = AccountSchema.safeParse({ ...validAccount, name: 'AB' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid account type', () => {
    const result = AccountSchema.safeParse({ ...validAccount, type: 'crypto' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid account types', () => {
    for (const type of ['bank', 'cash', 'credit']) {
      const result = AccountSchema.safeParse({ ...validAccount, type });
      expect(result.success).toBe(true);
    }
  });

  it('rejects non-COP currency', () => {
    const result = AccountSchema.safeParse({ ...validAccount, currency: 'USD' });
    expect(result.success).toBe(false);
  });

  it('accepts zero balance', () => {
    const result = AccountSchema.safeParse({ ...validAccount, calculatedBalance: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts negative balance (overdraft/credit)', () => {
    const result = AccountSchema.safeParse({ ...validAccount, calculatedBalance: -500000 });
    expect(result.success).toBe(true);
  });
});
