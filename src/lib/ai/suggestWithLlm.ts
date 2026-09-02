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
 * Local rules first. Optional cloud LLM when PRO + key + online and the local match is weak.
 * Today the cloud adapter is Gemini; swap/add providers here without touching the form.
 */
export async function suggestCategoryWithLlm(
    description: string,
    type: 'income' | 'expense',
    options: SuggestWithLlmOptions
): Promise<CategorySuggestion | null> {
    const local = await suggestCategory(description, type);
    const taggedLocal: CategorySuggestion | null = local
        ? { ...local, source: local.source ?? 'local' }
        : null;

    const online = options.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : false);

    if (
        options.signal?.aborted ||
        !options.isPro ||
        !hasGeminiApiKey() ||
        !online ||
        !shouldCallGemini(taggedLocal)
    ) {
        return taggedLocal;
    }

    try {
        const gemini = await suggestWithGemini(description, type, options.signal);
        return gemini ?? taggedLocal;
    } catch {
        return taggedLocal;
    }
}
