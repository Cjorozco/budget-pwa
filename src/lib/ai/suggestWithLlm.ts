import { suggestCategory, type CategorySuggestion } from './categorizer';
import { hasGeminiApiKey } from './geminiKey';
import { sanitizePii, suggestWithGemini } from './geminiSuggest';
import type { GeminiResult, ResolverResult } from './types';

export type { GeminiResult, ResolverResult };

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

async function compareWithLocalForDiagnostics(
    description: string,
    type: 'income' | 'expense',
    geminiResult: { status: 'success'; suggestion: CategorySuggestion }
): Promise<void> {
    if (!import.meta.env?.DEV) return;
    try {
        const localCandidate = await suggestCategory(description, type);
        const geminiConfidence = geminiResult.suggestion.confidence;
        const localConfidence = localCandidate?.confidence ?? 0;
        const winnerByConfidence = localCandidate && localConfidence > geminiConfidence ? 'local' : 'gemini';

        console.debug('[suggestCategoryWithLlm:diagnostics] Gemini vs Local priority comparison:', {
            description: sanitizePii(description),
            geminiConfidence,
            localConfidence: localCandidate ? localConfidence : null,
            winnerByConfidence,
            geminiPath: geminiResult.suggestion.categoryPath,
            localPath: localCandidate?.categoryPath ?? null,
        });
    } catch (err) {
        console.debug('[suggestCategoryWithLlm:diagnostics] Comparison failed:', err);
    }
}

/**
 * AI Suggestions:
 * When PRO + API key + online, Gemini takes top priority as the primary intelligent engine.
 * Local rules and heuristics act as safety fallback when offline, no key, or on AI error/timeout/rejection.
 */
export async function suggestCategoryWithLlm(
    description: string,
    type: 'income' | 'expense',
    options: SuggestWithLlmOptions
): Promise<ResolverResult> {
    if (options.signal?.aborted) return { status: 'no-match' };

    const online = options.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : false);

    let geminiUnavailableReason: 'not-pro' | 'no-api-key' | 'offline' | null = null;
    if (!options.isPro) {
        geminiUnavailableReason = 'not-pro';
    } else if (!hasGeminiApiKey()) {
        geminiUnavailableReason = 'no-api-key';
    } else if (!online) {
        geminiUnavailableReason = 'offline';
    }

    const canUseGemini = geminiUnavailableReason === null;

    if (canUseGemini) {
        try {
            const geminiResult = await suggestWithGemini(description, type, options.signal);

            if (geminiResult.status === 'success') {
                // PASO 2: Instrumentación diagnóstica no bloqueante
                void compareWithLocalForDiagnostics(description, type, geminiResult);
                return {
                    status: 'success',
                    suggestion: geminiResult.suggestion,
                    source: 'gemini',
                };
            }

            if (import.meta.env?.DEV) {
                console.debug('[suggestCategoryWithLlm] Gemini did not produce a valid suggestion, falling back to local engine. Diagnosis:', geminiResult);
            }
        } catch (err) {
            if (import.meta.env?.DEV) {
                console.debug('[suggestCategoryWithLlm] Unexpected error in suggestWithGemini, falling back to local:', err);
            }
        }
    } else {
        if (import.meta.env?.DEV) {
            console.debug(`[suggestCategoryWithLlm] Gemini unavailable (${geminiUnavailableReason}), using local engine.`);
        }
    }

    if (options.signal?.aborted) return { status: 'no-match' };

    // Ejecutar motor local exactamente como siempre
    const local = await suggestCategory(description, type);
    if (local) {
        if (import.meta.env?.DEV) {
            console.debug('[suggestCategoryWithLlm] Local fallback matched successfully:', local);
        }
        return {
            status: 'success',
            suggestion: { ...local, source: local.source ?? 'local' },
            source: 'local',
        };
    }

    if (import.meta.env?.DEV) {
        console.debug('[suggestCategoryWithLlm] Neither Gemini nor Local found a suggestion.');
    }

    return { status: 'no-match' };
}
