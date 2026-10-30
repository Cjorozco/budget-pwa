import { db } from '../db';
import type { SuggestionValidation } from '../types';
import { categoryNamesAreSimilar, normalizeForMatch } from './categoryRules';
import type { CategorySuggestion } from './categorizer';
import type { AiProviderType } from './types';

export function suggestionValidationId(
    description: string,
    type: 'income' | 'expense'
): string {
    return `${type}:${normalizeForMatch(description.trim())}`;
}

export function categorySuggestionsMatch(
    a: CategorySuggestion,
    b: CategorySuggestion
): boolean {
    if (a.categoryId && b.categoryId) {
        return a.categoryId === b.categoryId;
    }
    const normA = normalizeForMatch(a.categoryPath);
    const normB = normalizeForMatch(b.categoryPath);
    if (normA === normB) {
        return true;
    }
    const leafA = a.categoryPath.split(/[/›]/).pop()?.trim() ?? a.categoryPath;
    const leafB = b.categoryPath.split(/[/›]/).pop()?.trim() ?? b.categoryPath;
    return categoryNamesAreSimilar(leafA, leafB);
}

export function shouldAutoCallAi(
    validated: SuggestionValidation | undefined,
    forceRegenerate: boolean
): boolean {
    if (forceRegenerate) return true;
    return validated === undefined;
}

export async function getValidatedSuggestion(
    description: string,
    type: 'income' | 'expense'
): Promise<SuggestionValidation | undefined> {
    return db.suggestionValidations.get(suggestionValidationId(description, type));
}

export function suggestionFromValidation(record: SuggestionValidation): CategorySuggestion {
    const source: CategorySuggestion['source'] =
        record.chosenSource === 'local' ? 'local' : record.provider ?? 'local';
    return {
        categoryId: record.categoryId,
        categoryPath: record.categoryPath,
        confidence: 1,
        reason: record.reason,
        needsCategoryCreation: record.needsCategoryCreation,
        pendingCategory: record.pendingCategory,
        source,
        isValidated: true,
    };
}

export async function saveValidatedSuggestion(input: {
    description: string;
    type: 'income' | 'expense';
    suggestion: CategorySuggestion;
    chosenSource: 'local' | 'ai';
    provider?: AiProviderType;
}): Promise<void> {
    const normalizedDescription = normalizeForMatch(input.description.trim());
    const record: SuggestionValidation = {
        id: suggestionValidationId(input.description, input.type),
        type: input.type,
        normalizedDescription,
        categoryId: input.suggestion.categoryId,
        categoryPath: input.suggestion.categoryPath,
        reason: input.suggestion.reason,
        chosenSource: input.chosenSource,
        provider: input.provider,
        needsCategoryCreation: input.suggestion.needsCategoryCreation,
        pendingCategory: input.suggestion.pendingCategory,
        validatedAt: Date.now(),
    };
    await db.suggestionValidations.put(record);
}
