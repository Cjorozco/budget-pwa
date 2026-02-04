import { z } from 'zod';

export const AccountSchema = z.object({
    name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }),
    type: z.enum(['bank', 'cash', 'credit']),
    calculatedBalance: z.number(),
    currency: z.literal('COP'),
});

export type AccountFormData = z.infer<typeof AccountSchema>;

export const TransactionSchema = z.object({
    amount: z.number().min(1, 'El monto debe ser mayor a 0'),
    description: z.string().min(3, 'Descripción requerida'),
    categoryId: z.string().min(1, 'Categoría requerida'),
    accountId: z.string().min(1, 'Cuenta requerida'),
    date: z.number().default(() => Date.now()),
    type: z.enum(['income', 'expense']),
    tagIds: z.array(z.string()).default([]),
    // Optional AI Metadata
    suggestedCategoryId: z.string().optional(),
    wasCategorySuggestionAccepted: z.boolean().optional(),
    aiConfidence: z.number().optional(),
    isAmbiguous: z.boolean().optional(),
    needsReview: z.boolean().optional(),
});
