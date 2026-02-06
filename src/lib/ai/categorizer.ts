import { db } from '../db';

interface SuggestionResult {
    categoryId: string;
    tagIds: string[];
    confidence: number; // 0-1
    reason: string;
}

const KNOWN_ESTABLISHMENTS = [
    'oxxo', '7-eleven', 'crepes', 'starbucks', 'uber', 'didi', 'netflix', 'spotify',
    'exito', 'carulla', 'd1', 'jumbo', 'alkosto', 'mercado libre', 'amazon',
    'rappi', 'ifood', 'dominos', 'tostao', 'juan valdez'
];

const STOP_WORDS = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en', 'y', 'o',
    'pago', 'compra', 'transferencia', 'transf', 'pago de', 'gasto', 'costo', 'para', 'por',
    'con', 'sin', 'sus', 'mi', 'mis', 'tu', 'tus', 'su', 'sus'
]);

/**
 * Calculates Levenshtein distance between two strings.
 * Used for fuzzy matching typos (e.g. "Netflx" -> "Netflix").
 */
function levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1, // deletion
                matrix[j - 1][i] + 1, // insertion
                matrix[j - 1][i - 1] + indicator // substitution
            );
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Suggests a category and tags based on the transaction description and history.
 */
export async function suggestCategoryAndTags(
    description: string,
    type: 'income' | 'expense' = 'expense'
): Promise<SuggestionResult | null> {
    if (!description || description.length < 2) return null;

    const lowerDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Check for known establishments (Fuzzy Match)
    // Allow up to 2 typos for longer words, 1 for short
    let establishmentMatch = null;

    for (const est of KNOWN_ESTABLISHMENTS) {
        if (lowerDesc.includes(est)) {
            establishmentMatch = est;
            break;
        }
        // Fuzzy check only if enough length to justify variability
        if (est.length > 4) {
            const dist = levenshtein(lowerDesc, est);
            if (dist <= 2) {
                establishmentMatch = est;
                break;
            }

            // Also check individual tokens for cases like "Pago Netflx"
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
        // Look for precedent transactions with this establishment match
        const prevTxsWithMatch = await db.transactions
            .filter(tx => {
                const txDesc = tx.description.toLowerCase();
                return txDesc.includes(establishmentMatch!) && tx.type === type;
            })
            .toArray();

        if (prevTxsWithMatch.length > 0) {
            const catFreq = new Map<string, number>();
            const tagFreq = new Map<string, number>();

            // Weighted scoring: Recent transactions count more? 
            // For now, simpler frequency count but filtered by user acceptance if available
            prevTxsWithMatch.forEach(tx => {
                let weight = 1;
                if (tx.wasCategorySuggestionAccepted) weight = 2; // AI success reinforces itself

                catFreq.set(tx.categoryId, (catFreq.get(tx.categoryId) || 0) + weight);
                tx.tagIds?.forEach(tid => tagFreq.set(tid, (tagFreq.get(tid) || 0) + weight));
            });

            const bestCategoryId = Array.from(catFreq.entries()).sort((a, b) => b[1] - a[1])[0][0];
            const topTagIds = Array.from(tagFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);

            // Ensure the establishment tag is suggested if it exists
            const establishmentTag = await db.tags.filter(t => t.name.toLowerCase() === establishmentMatch).first();
            if (establishmentTag && !topTagIds.includes(establishmentTag.id)) {
                topTagIds.unshift(establishmentTag.id);
            }

            const confidence = prevTxsWithMatch.length >= 3 ? 0.95 : 0.8;

            return {
                categoryId: bestCategoryId,
                tagIds: topTagIds.slice(0, 3),
                confidence,
                reason: `Detecté "${establishmentMatch.charAt(0).toUpperCase() + establishmentMatch.slice(1)}" (aprox). Basado en historial.`
            };
        }
    }

    // 2. Fallback to generic similarity (Jaccard Index with Stop Words removed)
    const allTransactions = await db.transactions
        .where('type')
        .equals(type)
        .reverse()
        .limit(200) // Performance: look at last 200 txs only
        .toArray();

    if (allTransactions.length < 3) return null;

    const currentTokens = tokenize(description);
    if (currentTokens.length === 0) return null; // Only stop words provided?

    const matches = allTransactions.map(tx => {
        const txTokens = tokenize(tx.description);
        const intersection = currentTokens.filter(t => txTokens.includes(t));
        const union = new Set([...currentTokens, ...txTokens]).size;

        let similarity = union > 0 ? intersection.length / union : 0;

        // Bonus for exact token matches over just shared characters
        if (txTokens.some(t => currentTokens.includes(t))) { // Should be txTokens lowercase typo fixed below
            similarity += 0.1;
        }

        return { tx, similarity };
    });

    const highSimilarityMatches = matches
        .filter(m => m.similarity > 0.2) // Increased threshold slightly due to cleaner tokens
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);

    if (highSimilarityMatches.length === 0) return null;

    const categoryScores = new Map<string, number>();
    const tagScores = new Map<string, number>();

    highSimilarityMatches.forEach(({ tx, similarity }) => {
        // Boost score if this was a verified manual entry or accepted suggestion
        const score = similarity * (tx.wasCategorySuggestionAccepted ? 1.5 : 1);

        categoryScores.set(tx.categoryId, (categoryScores.get(tx.categoryId) || 0) + score);
        tx.tagIds?.forEach(tagId => tagScores.set(tagId, (tagScores.get(tagId) || 0) + score));
    });

    let bestCategoryId = '';
    let maxCatScore = 0;
    categoryScores.forEach((score, catId) => {
        if (score > maxCatScore) {
            maxCatScore = score;
            bestCategoryId = catId;
        }
    });

    const suggestedTagIds = Array.from(tagScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .filter(([_, score]) => score > 0.3)
        .map(([id]) => id);

    // Calculate confidence
    const topMatch = highSimilarityMatches[0];
    const confidence = Math.min((topMatch.similarity * 0.5) + (maxCatScore > 1.5 ? 0.4 : 0.2), 0.9);

    return {
        categoryId: bestCategoryId,
        tagIds: suggestedTagIds,
        confidence,
        reason: `Basado en ${highSimilarityMatches.length} transacciones similares`
    };
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9\s]/g, " ") // Replace special chars with space
        .split(/\s+/)
        .filter(t => t.length > 2) // Ignore short words
        .filter(t => !STOP_WORDS.has(t)); // Remove stop words
}

