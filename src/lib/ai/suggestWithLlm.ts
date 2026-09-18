import { suggestCategory, type CategorySuggestion } from './categorizer';
import { getSelectedAiProvider, hasAiApiKey } from './gateway/config';
import { sanitizePii, suggestWithAiProvider } from './geminiSuggest';
import type { GeminiResult, LlmResult, ResolverResult } from './types';

export type { GeminiResult, LlmResult, ResolverResult };

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
    onProgress?: (attempt: import('./types').ModelAttempt, friendlyMessage: string) => void;
}

async function compareWithLocalForDiagnostics(
    description: string,
    type: 'income' | 'expense',
    aiResult: { status: 'success'; suggestion: CategorySuggestion }
): Promise<void> {
    if (!import.meta.env?.DEV) return;
    try {
        const localCandidate = await suggestCategory(description, type);
        const aiConfidence = aiResult.suggestion.confidence;
        const localConfidence = localCandidate?.confidence ?? 0;
        const winnerByConfidence = localCandidate && localConfidence > aiConfidence ? 'local' : 'ai';

        console.debug('[suggestCategoryWithLlm:diagnostics] AI vs Local priority comparison:', {
            description: sanitizePii(description),
            aiConfidence,
            localConfidence: localCandidate ? localConfidence : null,
            winnerByConfidence,
            aiPath: aiResult.suggestion.categoryPath,
            localPath: localCandidate?.categoryPath ?? null,
        });
    } catch (err) {
        console.debug('[suggestCategoryWithLlm:diagnostics] Comparison failed:', err);
    }
}

/**
 * AI Suggestions:
 * When PRO + API key + online, the active AI provider (Groq, Gemini, OpenAI, etc.)
 * takes top priority as the primary intelligent engine.
 * Local rules and heuristics act as safety fallback when offline, no key, or on AI error/timeout/rejection.
 */
export async function suggestCategoryWithLlm(
    description: string,
    type: 'income' | 'expense',
    options: SuggestWithLlmOptions
): Promise<ResolverResult> {
    if (options.signal?.aborted) return { status: 'no-match' };

    const online = options.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : false);
    const activeProvider = getSelectedAiProvider();
    const hasKey = hasAiApiKey(activeProvider);

    let aiUnavailableReason: 'not-pro' | 'no-api-key' | 'offline' | null = null;
    if (!options.isPro) {
        aiUnavailableReason = 'not-pro';
    } else if (!hasKey) {
        aiUnavailableReason = 'no-api-key';
    } else if (!online) {
        aiUnavailableReason = 'offline';
    }

    const canUseAi = aiUnavailableReason === null;
    let aiDiagnosis: LlmResult | undefined = undefined;

    if (canUseAi) {
        try {
            const aiResult = await suggestWithAiProvider(description, type, options.signal, options.onProgress);

            if (aiResult.status === 'success') {
                void compareWithLocalForDiagnostics(description, type, aiResult);
                return {
                    status: 'success',
                    suggestion: aiResult.suggestion,
                    source: aiResult.providerUsed ?? activeProvider,
                    aiDiagnosis: aiResult,
                    geminiDiagnosis: aiResult,
                };
            }

            aiDiagnosis = aiResult;

            if (import.meta.env?.DEV) {
                console.debug(`[suggestCategoryWithLlm] ${activeProvider} did not produce a valid suggestion, falling back to local engine. Diagnosis:`, aiResult);
            }
        } catch (err) {
            aiDiagnosis = { status: 'error', reason: 'network-error' };
            if (import.meta.env?.DEV) {
                console.debug(`[suggestCategoryWithLlm] Unexpected error in suggestWithAiProvider (${activeProvider}), falling back to local:`, err);
            }
        }
    } else {
        aiDiagnosis = { status: 'unavailable', reason: aiUnavailableReason! };
        if (import.meta.env?.DEV) {
            console.debug(`[suggestCategoryWithLlm] AI unavailable (${aiUnavailableReason}) for provider ${activeProvider}, using local engine.`);
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
            aiDiagnosis,
            geminiDiagnosis: aiDiagnosis,
        };
    }

    if (import.meta.env?.DEV) {
        console.debug('[suggestCategoryWithLlm] Neither AI nor Local found a suggestion.');
    }

    return {
        status: 'no-match',
        aiDiagnosis,
        geminiDiagnosis: aiDiagnosis,
    };
}
