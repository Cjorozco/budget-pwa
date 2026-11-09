import { db } from '../db';
import type { SuggestionValidation } from '../types';
import { isSelectableCategory } from './categoryResolver';
import { categoryNamesAreSimilar, normalizeForMatch } from './categoryRules';
import type { CategorySuggestion } from './categorizer';
import type { AiProviderType } from './types';

const MIN_LEARNABLE_DESCRIPTION_LENGTH = 3;
const CONFIRMED_BY_USER_REASON = 'La elegiste antes para esta descripción.';

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
    const record = await db.suggestionValidations.get(suggestionValidationId(description, type));
    if (record?.categoryId && !(await isSelectableCategory(record.categoryId, type))) return undefined;
    return record;
}

/** Remembers the category the user saved for a description. Runs only when a movement is saved. */
export async function learnCategoryForDescription(input: {
    description: string;
    type: 'income' | 'expense';
    categoryId: string;
    categoryPath: string;
    chosenSource?: 'local' | 'ai';
    provider?: AiProviderType;
}): Promise<void> {
    if (input.description.trim().length < MIN_LEARNABLE_DESCRIPTION_LENGTH) return;
    await saveValidatedSuggestion({
        description: input.description,
        type: input.type,
        suggestion: {
            categoryId: input.categoryId,
            categoryPath: input.categoryPath,
            confidence: 1,
            reason: CONFIRMED_BY_USER_REASON,
            needsCategoryCreation: false,
        },
        chosenSource: input.chosenSource ?? 'local',
        provider: input.provider,
    });
}

export async function deleteValidatedSuggestion(id: string): Promise<void> {
    await db.suggestionValidations.delete(id);
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
