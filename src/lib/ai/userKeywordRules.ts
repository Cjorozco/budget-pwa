import { db } from '../db';
import type { UserKeywordRule } from '../types';
import { isSelectableCategory } from './categoryResolver';
import { containsWholeWord, normalizeForMatch } from './categoryRules';

const MIN_KEYWORD_LENGTH = 3;

export function normalizeKeyword(text: string): string {
    return normalizeForMatch(text).trim().replace(/\s+/g, ' ');
}

/** Saves a keyword for a subcategory. The same keyword again replaces the previous subcategory. */
export async function addUserKeywordRule(input: { keyword: string; categoryId: string }): Promise<void> {
    const keyword = normalizeKeyword(input.keyword);
    if (keyword.length < MIN_KEYWORD_LENGTH) throw new Error('Keyword too short');

    const category = await db.categories.get(input.categoryId);
    if (!category || !(await isSelectableCategory(category.id))) throw new Error('Category cannot receive movements');

    await db.userKeywordRules.put({
        id: `${category.type}:${keyword}`,
        type: category.type,
        keyword,
        categoryId: category.id,
        createdAt: Date.now(),
    });
}

export async function deleteUserKeywordRule(id: string): Promise<void> {
    await db.userKeywordRules.delete(id);
}

/** Rules found in the description. Only the longest keyword counts; several results mean a tie. */
export async function matchUserKeywordRules(
    description: string,
    type: 'income' | 'expense'
): Promise<UserKeywordRule[]> {
    const normalized = normalizeKeyword(description);
    const rules = await db.userKeywordRules.where('type').equals(type).toArray();

    const matches: UserKeywordRule[] = [];
    for (const rule of rules) {
        if (containsWholeWord(normalized, rule.keyword) && (await isSelectableCategory(rule.categoryId))) {
            matches.push(rule);
        }
    }

    const longest = Math.max(0, ...matches.map((rule) => rule.keyword.length));
    const seenCategories = new Set<string>();
    return matches
        .filter((rule) => rule.keyword.length === longest)
        .sort((a, b) => a.keyword.localeCompare(b.keyword))
        .filter((rule) => {
            if (seenCategories.has(rule.categoryId)) return false;
            seenCategories.add(rule.categoryId);
            return true;
        });
}
