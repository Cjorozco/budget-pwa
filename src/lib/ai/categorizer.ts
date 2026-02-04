import { db } from '../db';
import type { Transaction, Category, Tag } from '../types';

interface SuggestionResult {
    categoryId: string;
    tagIds: string[];
    confidence: number; // 0-1
    reason: string; // Explanation
}

const KNOWN_ESTABLISHMENTS = ['oxxo', '7-eleven', 'crepes', 'starbucks', 'uber', 'didi', 'netflix', 'spotify', 'exito', 'carulla', 'd1'];

/**
 * Suggests a category and tags based on the transaction description and history.
 */
export async function suggestCategoryAndTags(
    description: string,
    type: 'income' | 'expense' = 'expense'
): Promise<SuggestionResult | null> {
    if (!description || description.length < 2) return null;

    const lowerDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Check for known establishments
    const establishment = KNOWN_ESTABLISHMENTS.find(e => lowerDesc.includes(e));

    if (establishment) {
        const prevTxsWithMatch = await db.transactions
            .filter(tx => tx.description.toLowerCase().includes(establishment) && tx.type === type)
            .toArray();

        if (prevTxsWithMatch.length > 0) {
            const catFreq = new Map<string, number>();
            const tagFreq = new Map<string, number>();

            prevTxsWithMatch.forEach(tx => {
                catFreq.set(tx.categoryId, (catFreq.get(tx.categoryId) || 0) + 1);
                tx.tagIds?.forEach(tid => tagFreq.set(tid, (tagFreq.get(tid) || 0) + 1));
            });

            const bestCategoryId = Array.from(catFreq.entries()).sort((a, b) => b[1] - a[1])[0][0];
            const topTagIds = Array.from(tagFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);

            // Ensure the establishment tag is suggested if it exists
            const establishmentTag = await db.tags.filter(t => t.name.toLowerCase() === establishment).first();
            if (establishmentTag && !topTagIds.includes(establishmentTag.id)) {
                topTagIds.unshift(establishmentTag.id);
            }

            const confidence = prevTxsWithMatch.length >= 3 ? 0.9 : 0.65;

            return {
                categoryId: bestCategoryId,
                tagIds: topTagIds.slice(0, 3),
                confidence,
                reason: `Detecté "${establishment.charAt(0).toUpperCase() + establishment.slice(1)}". Basado en ${prevTxsWithMatch.length} registros previos.`
            };
        }
    }

    // 2. Fallback to generic similarity
    const allTransactions = await db.transactions
        .where('type')
        .equals(type)
        .toArray();

    if (allTransactions.length < 3) return null;

    const currentTokens = tokenize(description);
    const matches = allTransactions.map(tx => {
        const txTokens = tokenize(tx.description);
        const intersection = currentTokens.filter(t => txTokens.includes(t));
        const union = new Set([...currentTokens, ...txTokens]).size;
        const similarity = union > 0 ? intersection.length / union : 0;
        return { tx, similarity };
    });

    const highSimilarityMatches = matches
        .filter(m => m.similarity > 0.1)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);

    if (highSimilarityMatches.length === 0) return null;

    const categoryScores = new Map<string, number>();
    const tagScores = new Map<string, number>();

    highSimilarityMatches.forEach(({ tx, similarity }) => {
        categoryScores.set(tx.categoryId, (categoryScores.get(tx.categoryId) || 0) + similarity);
        tx.tagIds?.forEach(tagId => tagScores.set(tagId, (tagScores.get(tagId) || 0) + similarity));
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
        .filter(([_, score]) => score > 0.2)
        .map(([id]) => id);

    const topSimilarity = highSimilarityMatches[0].similarity;
    const totalSim = highSimilarityMatches.reduce((acc, m) => acc + m.similarity, 0);
    const consistency = maxCatScore / totalSim;
    const confidence = (topSimilarity * 0.4) + (consistency * 0.6);

    return {
        categoryId: bestCategoryId,
        tagIds: suggestedTagIds,
        confidence,
        reason: `Basado en ${highSimilarityMatches.length} transacciones similares (${Math.round(confidence * 100)}% de confianza)`
    };
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9\s]/g, "") // Remove special chars
        .split(/\s+/)
        .filter(t => t.length > 2); // Ignore short words
}
