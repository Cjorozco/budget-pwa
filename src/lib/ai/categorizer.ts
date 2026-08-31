import { db } from '../db';
import { DESCRIPTION_CATEGORY_HINTS, matchCategoryRule, normalizeForMatch } from './categoryRules';
import {
    findCategoryByPath,
    formatCategoryPath,
    resolveCategoryPathLabel,
} from './categoryResolver';
import type { Category } from '../types';

export interface CategorySuggestion {
    categoryId: string | null;
    categoryPath: string;
    confidence: number;
    reason: string;
    /** La categoría sugerida aún no existe en la DB */
    needsCategoryCreation: boolean;
    pendingCategory?: {
        type: 'income' | 'expense';
        parentName: string;
        subcategoryName?: string;
    };
    /** Otras categorías del usuario con puntaje similar */
    alternatives?: Array<{ categoryId: string; categoryPath: string }>;
}

const KNOWN_ESTABLISHMENTS = [
    'oxxo', '7-eleven', 'crepes', 'starbucks', 'uber', 'didi', 'netflix', 'spotify',
    'exito', 'carulla', 'd1', 'jumbo', 'alkosto', 'mercado libre', 'amazon',
    'rappi', 'ifood', 'dominos', 'tostao', 'juan valdez',
];

const STOP_WORDS = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en', 'y', 'o',
    'pago', 'compra', 'transferencia', 'transf', 'pago de', 'gasto', 'costo', 'para', 'por',
    'con', 'sin', 'sus', 'mi', 'mis', 'tu', 'tus', 'su', 'sus',
]);

/**
 * Calculates Levenshtein distance between two strings.
 * Used for fuzzy matching typos (e.g. "Netflx" -> "Netflix").
 * @internal Exported for testing
 */
export function levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + indicator
            );
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Tokenizes text for similarity matching.
 * @internal Exported for testing
 */
export function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2)
        .filter((t) => !STOP_WORDS.has(t));
}

function isGenericCategoryName(name: string): boolean {
    return new Set(['otros', 'otro', 'varios']).has(normalizeForMatch(name));
}

function scoreUserCategory(
    cat: Category,
    parent: Category | undefined,
    descNorm: string,
    descTokens: string[]
): number {
    if (isGenericCategoryName(cat.name)) return 0;

    const nameNorm = normalizeForMatch(cat.name);
    const parentNorm = parent ? normalizeForMatch(parent.name) : '';
    const nameTokens = tokenize(cat.name);
    let score = 0;

    if (nameNorm.length >= 4 && descNorm.includes(nameNorm)) score += 5;
    if (parentNorm.length >= 4 && !isGenericCategoryName(parent?.name ?? '') && descNorm.includes(parentNorm)) {
        score += 2;
    }

    score += nameTokens.filter((t) => descTokens.includes(t)).length * 2;

    for (const group of DESCRIPTION_CATEGORY_HINTS) {
        const kwHit = group.keywords.some((k) => descNorm.includes(normalizeForMatch(k)));
        if (!kwHit) continue;
        const ownHint = group.nameHints.some((h) => nameNorm.includes(h));
        const parentHint = group.nameHints.some((h) => parentNorm.includes(h));
        if (ownHint) score += 6;
        else if (parentHint) score += 3;
    }

    return score;
}

async function suggestFromUserCatalog(
    description: string,
    type: 'income' | 'expense'
): Promise<CategorySuggestion | null> {
    const categories = await db.categories.filter((c) => c.isActive && c.type === type).toArray();
    if (categories.length === 0) return null;

    const byId = new Map(categories.map((c) => [c.id, c]));
    const descNorm = normalizeForMatch(description);
    const descTokens = tokenize(description);

    const ranked = categories
        .map((cat) => {
            const parent = cat.parentId ? byId.get(cat.parentId) : undefined;
            return { cat, score: scoreUserCategory(cat, parent, descNorm, descTokens) };
        })
        .filter((row) => row.score >= 4)
        .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) return null;

    const best = ranked[0];
    const runnerUp = ranked[1];
    const closeSecond = Boolean(
        runnerUp && runnerUp.score >= best.score - 2 && runnerUp.cat.id !== best.cat.id
    );

    const alternatives: Array<{ categoryId: string; categoryPath: string }> = [];
    if (closeSecond && runnerUp) {
        alternatives.push({
            categoryId: runnerUp.cat.id,
            categoryPath: await resolveCategoryPathLabel(runnerUp.cat.id),
        });
    }

    return {
        categoryId: best.cat.id,
        categoryPath: await resolveCategoryPathLabel(best.cat.id),
        confidence: closeSecond ? 0.62 : 0.78,
        reason: closeSecond
            ? 'Varias de tus categorías encajan. Elige la que uses para este gasto.'
            : 'Encaja con una categoría que ya tienes.',
        needsCategoryCreation: false,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
}

async function suggestFromKeywordRules(
    description: string,
    type: 'income' | 'expense'
): Promise<CategorySuggestion | null> {
    const rule = matchCategoryRule(description, type);
    if (!rule) return null;

    const path = formatCategoryPath(rule.parentName, rule.subcategoryName);
    const existing = await findCategoryByPath(type, rule.parentName, rule.subcategoryName);

    if (existing) {
        return {
            categoryId: existing.id,
            categoryPath: await resolveCategoryPathLabel(existing.id),
            confidence: rule.confidence,
            reason: rule.reason,
            needsCategoryCreation: false,
        };
    }

    return {
        categoryId: null,
        categoryPath: path,
        confidence: rule.confidence,
        reason: `${rule.reason}. Esta categoría aún no existe.`,
        needsCategoryCreation: true,
        pendingCategory: {
            type: rule.type,
            parentName: rule.parentName,
            subcategoryName: rule.subcategoryName,
        },
    };
}

/**
 * Sugiere categoría según descripción, reglas y historial local.
 */
export async function suggestCategory(
    description: string,
    type: 'income' | 'expense' = 'expense'
): Promise<CategorySuggestion | null> {
    if (!description || description.length < 2) return null;

    const lowerDesc = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Árbol del usuario (nombres + pistas). Prioridad: no inventar categorías si ya tiene una.
    const catalogSuggestion = await suggestFromUserCatalog(description, type);
    if (catalogSuggestion) return catalogSuggestion;

    // 2. Reglas por palabras clave (pueden proponer crear una categoría)
    const ruleSuggestion = await suggestFromKeywordRules(description, type);
    if (ruleSuggestion) return ruleSuggestion;

    // 2. Establecimientos conocidos + historial
    let establishmentMatch: string | null = null;

    for (const est of KNOWN_ESTABLISHMENTS) {
        if (lowerDesc.includes(est)) {
            establishmentMatch = est;
            break;
        }
        if (est.length > 4) {
            const dist = levenshtein(lowerDesc, est);
            if (dist <= 2) {
                establishmentMatch = est;
                break;
            }
            const tokens = lowerDesc.split(' ');
            for (const token of tokens) {
                if (levenshtein(token, est) <= (est.length > 6 ? 2 : 1)) {
                    establishmentMatch = est;
                    break;
                }
            }
        }
        if (establishmentMatch) break;
    }

    if (establishmentMatch) {
        const prevTxsWithMatch = await db.transactions
            .filter((tx) => {
                const txDesc = tx.description.toLowerCase();
                return txDesc.includes(establishmentMatch!) && tx.type === type;
            })
            .toArray();

        if (prevTxsWithMatch.length > 0) {
            const catFreq = new Map<string, number>();
            prevTxsWithMatch.forEach((tx) => {
                const weight = tx.wasCategorySuggestionAccepted ? 2 : 1;
                catFreq.set(tx.categoryId, (catFreq.get(tx.categoryId) || 0) + weight);
            });

            const bestCategoryId = Array.from(catFreq.entries()).sort((a, b) => b[1] - a[1])[0][0];
            const confidence = prevTxsWithMatch.length >= 3 ? 0.95 : 0.8;

            return {
                categoryId: bestCategoryId,
                categoryPath: await resolveCategoryPathLabel(bestCategoryId),
                confidence,
                reason: `Detecté "${establishmentMatch.charAt(0).toUpperCase() + establishmentMatch.slice(1)}" (aprox). Basado en historial.`,
                needsCategoryCreation: false,
            };
        }
    }

    // 3. Similitud con transacciones recientes
    const allTransactions = await db.transactions
        .where('type')
        .equals(type)
        .reverse()
        .limit(200)
        .toArray();

    if (allTransactions.length < 3) return null;

    const currentTokens = tokenize(description);
    if (currentTokens.length === 0) return null;

    const matches = allTransactions.map((tx) => {
        const txTokens = tokenize(tx.description);
        const intersection = currentTokens.filter((t) => txTokens.includes(t));
        const union = new Set([...currentTokens, ...txTokens]).size;
        let similarity = union > 0 ? intersection.length / union : 0;
        if (txTokens.some((t) => currentTokens.includes(t))) similarity += 0.1;
        return { tx, similarity };
    });

    const highSimilarityMatches = matches
        .filter((m) => m.similarity > 0.2)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);

    if (highSimilarityMatches.length === 0) return null;

    const categoryScores = new Map<string, number>();
    highSimilarityMatches.forEach(({ tx, similarity }) => {
        const score = similarity * (tx.wasCategorySuggestionAccepted ? 1.5 : 1);
        categoryScores.set(tx.categoryId, (categoryScores.get(tx.categoryId) || 0) + score);
    });

    let bestCategoryId = '';
    let maxCatScore = 0;
    categoryScores.forEach((score, catId) => {
        if (score > maxCatScore) {
            maxCatScore = score;
            bestCategoryId = catId;
        }
    });

    const topMatch = highSimilarityMatches[0];
    const confidence = Math.min((topMatch.similarity * 0.5) + (maxCatScore > 1.5 ? 0.4 : 0.2), 0.9);

    return {
        categoryId: bestCategoryId,
        categoryPath: await resolveCategoryPathLabel(bestCategoryId),
        confidence,
        reason: `Basado en ${highSimilarityMatches.length} transacciones similares`,
        needsCategoryCreation: false,
    };
}

/** @deprecated Usar suggestCategory */
export async function suggestCategoryAndTags(
    description: string,
    type: 'income' | 'expense' = 'expense'
) {
    const suggestion = await suggestCategory(description, type);
    if (!suggestion) return null;
    return {
        categoryId: suggestion.categoryId ?? '',
        tagIds: [] as string[],
        confidence: suggestion.confidence,
        reason: suggestion.reason,
    };
}
