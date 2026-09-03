import { suggestCategory, type CategorySuggestion } from './categorizer';
import { hasGeminiApiKey } from './geminiKey';
import { suggestWithGemini } from './geminiSuggest';

export function shouldCallGemini(local: CategorySuggestion | null): boolean {
    if (!local) return true;
    if (local.needsCategoryCreation) return true;
    if (!local.categoryId) return true;
    if (local.confidence < 0.7) return true;
    if (local.alternatives && local.alternatives.length > 0) return true;
    return false;
}

export interface SuggestWithLlmOptions {
    isPro: boolean;
    signal?: AbortSignal;
    online?: boolean;
}

/**
 * AI Suggestions:
 * When PRO + API key + online, Gemini takes top priority as the primary intelligent engine.
 * Local rules and heuristics act as safety fallback when offline, no key, or on AI error/timeout.
 */
export async function suggestCategoryWithLlm(
    description: string,
    type: 'income' | 'expense',
    options: SuggestWithLlmOptions
): Promise<CategorySuggestion | null> {
    if (options.signal?.aborted) return null;

    const online = options.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : false);
    const canUseGemini = options.isPro && hasGeminiApiKey() && online;

    if (canUseGemini) {
        try {
            const gemini = await suggestWithGemini(description, type, options.signal);
            if (gemini) {
                return gemini;
            }
        } catch {
            // Fall back to local rules if Gemini fails or times out
        }
    }

    if (options.signal?.aborted) return null;

    const local = await suggestCategory(description, type);
    return local ? { ...local, source: local.source ?? 'local' } : null;
}
