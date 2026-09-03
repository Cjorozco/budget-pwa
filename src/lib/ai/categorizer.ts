import { db } from '../db';
import {
    categoryNamesAreSimilar,
    DESCRIPTION_CATEGORY_HINTS,
    matchCategoryRule,
    normalizeForMatch,
    type CategoryKeywordRule,
} from './categoryRules';
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
    /** local = reglas/historial; gemini = Google Gemini (PRO + API key) */
    source?: 'local' | 'gemini';
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

interface CatalogMatch {
    category: Category;
    /** Categoría raíz con hijos: es un cajón amplio, no una hoja donde clasificar */
    isBroadParent: boolean;
    runnerUp?: Category;
}

async function matchUserCatalog(
    description: string,
    type: 'income' | 'expense'
): Promise<CatalogMatch | null> {
    const categories = await db.categories.filter((c) => c.isActive && c.type === type).toArray();
    if (categories.length === 0) return null;

    const byId = new Map(categories.map((c) => [c.id, c]));
    const parentsWithChildren = new Set(
        categories.map((c) => c.parentId).filter((id): id is string => Boolean(id))
    );
    const descNorm = normalizeForMatch(description);
    const descTokens = tokenize(description);

    const ranked = categories
        .map((cat) => {
            const parent = cat.parentId ? byId.get(cat.parentId) : undefined;
            let score = scoreUserCategory(cat, parent, descNorm, descTokens);
            // Las hojas ganan: registrar en la raíz mezcla gastos distintos en un mismo bucket.
            if (score > 0 && !cat.parentId && parentsWithChildren.has(cat.id)) score -= 2;
            return { cat, score };
        })
        .filter((row) => row.score >= 4)
        .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) return null;

    const best = ranked[0];
    const runnerUp = ranked[1];
    const closeSecond = runnerUp && runnerUp.score >= best.score - 2 && runnerUp.cat.id !== best.cat.id;

    return {
        category: best.cat,
        isBroadParent: !best.cat.parentId,
        runnerUp: closeSecond ? runnerUp.cat : undefined,
    };
}

async function buildCatalogSuggestion(match: CatalogMatch): Promise<CategorySuggestion> {
    const alternatives = match.runnerUp
        ? [
              {
                  categoryId: match.runnerUp.id,
                  categoryPath: await resolveCategoryPathLabel(match.runnerUp.id),
              },
          ]
        : undefined;

    return {
        categoryId: match.category.id,
        categoryPath: await resolveCategoryPathLabel(match.category.id),
        confidence: alternatives ? 0.62 : 0.78,
        reason: alternatives
            ? 'Varias de tus categorías encajan. Elige la que uses para este gasto.'
            : 'Encaja con una categoría que ya tienes.',
        needsCategoryCreation: false,
        alternatives,
    };
}

async function buildRuleSuggestion(
    rule: CategoryKeywordRule,
    type: 'income' | 'expense'
): Promise<CategorySuggestion> {
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

    const existingParent = rule.subcategoryName
        ? await findCategoryByPath(type, rule.parentName)
        : null;

    const reason = existingParent
        ? `${rule.reason}. Falta "${rule.subcategoryName}" dentro de "${existingParent.name}": puedo crearla.`
        : `${rule.reason}. Esta categoría aún no existe.`;

    return {
        categoryId: null,
        categoryPath: path,
        confidence: rule.confidence,
        reason,
        needsCategoryCreation: true,
        pendingCategory: {
            type: rule.type,
            parentName: rule.parentName,
            subcategoryName: rule.subcategoryName,
        },
    };
}

async function matchTransactionHistory(
    description: string,
    type: 'income' | 'expense'
): Promise<CategorySuggestion | null> {
    const lowerDesc = normalizeForMatch(description);
    const currentTokens = tokenize(description);

    const allTransactions = await db.transactions
        .where('type')
        .equals(type)
        .reverse()
        .limit(200)
        .toArray();

    if (allTransactions.length === 0) return null;

    // 1. Coincidencia exacta de texto con transacciones previas
    const exactTx = allTransactions.find(
        (tx) => normalizeForMatch(tx.description) === lowerDesc && Boolean(tx.categoryId)
    );
    if (exactTx) {
        const activeCat = await db.categories.get(exactTx.categoryId);
        if (activeCat && activeCat.isActive) {
            return {
                categoryId: exactTx.categoryId,
                categoryPath: await resolveCategoryPathLabel(exactTx.categoryId),
                confidence: 0.95,
                reason: 'Coincide con tus transacciones anteriores.',
                needsCategoryCreation: false,
            };
        }
    }

    // 2. Establecimientos conocidos con transacciones previas
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
        const prevTxsWithMatch = allTransactions.filter((tx) => {
            const txDesc = normalizeForMatch(tx.description);
            return txDesc.includes(establishmentMatch!) && Boolean(tx.categoryId);
        });

        if (prevTxsWithMatch.length > 0) {
            const catFreq = new Map<string, number>();
            prevTxsWithMatch.forEach((tx) => {
                const weight = tx.wasCategorySuggestionAccepted ? 2 : 1;
                catFreq.set(tx.categoryId, (catFreq.get(tx.categoryId) || 0) + weight);
            });

            const bestCategoryId = Array.from(catFreq.entries()).sort((a, b) => b[1] - a[1])[0][0];
            const activeCat = await db.categories.get(bestCategoryId);
            if (activeCat && activeCat.isActive) {
                const confidence = prevTxsWithMatch.length >= 2 ? 0.95 : 0.85;
                return {
                    categoryId: bestCategoryId,
                    categoryPath: await resolveCategoryPathLabel(bestCategoryId),
                    confidence,
                    reason: `Detecté "${establishmentMatch.charAt(0).toUpperCase() + establishmentMatch.slice(1)}" (aprendido de tu historial).`,
                    needsCategoryCreation: false,
                };
            }
        }
    }

    if (currentTokens.length === 0) return null;

    const matches = allTransactions
        .filter((tx) => Boolean(tx.categoryId))
        .map((tx) => {
            const txTokens = tokenize(tx.description);
            const intersection = currentTokens.filter((t) => txTokens.includes(t));
            const union = new Set([...currentTokens, ...txTokens]).size;
            let similarity = union > 0 ? intersection.length / union : 0;
            if (txTokens.some((t) => currentTokens.includes(t))) similarity += 0.1;
            return { tx, similarity };
        });

    const highSimilarityMatches = matches
        .filter((m) => m.similarity >= 0.3)
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

    if (!bestCategoryId) return null;
    const activeCat = await db.categories.get(bestCategoryId);
    if (!activeCat || !activeCat.isActive) return null;

    const topMatch = highSimilarityMatches[0];
    const confidence = Math.min((topMatch.similarity * 0.5) + (maxCatScore > 1.2 ? 0.4 : 0.25), 0.9);

    return {
        categoryId: bestCategoryId,
        categoryPath: await resolveCategoryPathLabel(bestCategoryId),
        confidence,
        reason: `Basado en transacciones similares ("${topMatch.tx.description}").`,
        needsCategoryCreation: false,
    };
}

/**
 * Sugiere categoría según historial aprendido, árbol del usuario y reglas locales.
 */
export async function suggestCategory(
    description: string,
    type: 'income' | 'expense' = 'expense'
): Promise<CategorySuggestion | null> {
    if (!description || description.length < 2) return null;

    // 1. Historial previo del usuario (aprendizaje de transacciones reales).
    // Si el usuario ya categorizó esta descripción o establecimiento antes, esa elección manda.
    const historyMatch = await matchTransactionHistory(description, type);
    if (historyMatch && historyMatch.confidence >= 0.8) {
        return historyMatch;
    }

    // 2. Árbol del usuario + reglas. Se prefiere la opción MÁS específica:
    // Solo si el usuario tiene una raíz ("Gastos financieros") y la regla conoce una hoja
    // bajo ESA MISMA raíz ("Gastos financieros › Impuestos"), se ofrece crearla.
    // Si la regla propone una raíz inexistente (ej: "Niños") pero el usuario ya tiene
    // una categoría personalizada (ej: "Sofía › Ruta"), gana la categoría del usuario.
    const catalogMatch = await matchUserCatalog(description, type);
    const rule = matchCategoryRule(description, type);
    const ruleTargetsSubcategory = Boolean(rule?.subcategoryName);
    const ruleTargetsSameParent = Boolean(
        rule &&
        catalogMatch &&
        categoryNamesAreSimilar(catalogMatch.category.name, rule.parentName)
    );

    if (catalogMatch && !(catalogMatch.isBroadParent && ruleTargetsSubcategory && ruleTargetsSameParent)) {
        return buildCatalogSuggestion(catalogMatch);
    }

    const ruleSuggestion = rule ? await buildRuleSuggestion(rule, type) : null;
    if (ruleSuggestion) {
        if (!catalogMatch) return ruleSuggestion;
        // La raíz que ya tiene sigue disponible por si prefiere no crear la hoja.
        return {
            ...ruleSuggestion,
            alternatives: [
                {
                    categoryId: catalogMatch.category.id,
                    categoryPath: await resolveCategoryPathLabel(catalogMatch.category.id),
                },
            ],
        };
    }

    // 3. Fallback de historial si tuvo confianza moderada
    if (historyMatch) {
        return historyMatch;
    }

    return null;
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
