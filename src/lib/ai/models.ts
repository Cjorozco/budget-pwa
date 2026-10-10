import type { AiProviderType } from './types';

/**
 * Single source of truth for AI model IDs.
 * Each chain is ordered: the first model is tried first, the rest are fallbacks.
 * When a provider deprecates a model, change it here only.
 */

export type GeminiThinkingLevel = 'minimal' | 'medium' | 'high';

export interface ModelSpec {
    id: string;
    label: string;
    /** Gemini only: `thinkingConfig.thinkingLevel`. Not every model accepts every level. */
    thinkingLevel?: GeminiThinkingLevel;
    /** Anthropic only: the model rejects `temperature` with a 400. */
    omitTemperature?: boolean;
}

type ChainedProvider = 'gemini' | 'openai' | 'anthropic' | 'groq';

export const AI_MODEL_CHAINS: Record<ChainedProvider, readonly ModelSpec[]> = {
    // Verified against the live API: 3.5-flash-lite rejects `thinkingBudget` (400),
    // 3.8-flash rejects thinkingLevel "minimal" (400).
    gemini: [
        { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', thinkingLevel: 'minimal' },
        { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', thinkingLevel: 'minimal' },
        { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', thinkingLevel: 'medium' },
        { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', thinkingLevel: 'medium' },
    ],
    openai: [
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { id: 'gpt-4o', label: 'GPT-4o' },
    ],
    anthropic: [
        { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', omitTemperature: true },
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
        { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', omitTemperature: true },
    ],
    groq: [
        { id: 'openai/gpt-oss-120b', label: 'Groq openai/gpt-oss-120b' },
        { id: 'openai/gpt-oss-20b', label: 'Groq openai/gpt-oss-20b' },
        { id: 'groq/compound', label: 'Groq groq/compound' },
        { id: 'qwen/qwen3.8-27b', label: 'Groq qwen/qwen3.8-27b' },
    ],
};

export function getModelChain(provider: ChainedProvider): readonly ModelSpec[] {
    return AI_MODEL_CHAINS[provider];
}

export function getModelSpec(provider: AiProviderType, modelId: string): ModelSpec | undefined {
    if (!(provider in AI_MODEL_CHAINS)) return undefined;
    return AI_MODEL_CHAINS[provider as ChainedProvider].find((m) => m.id === modelId);
}

export function getModelLabel(provider: AiProviderType, modelId: string): string {
    return getModelSpec(provider, modelId)?.label ?? modelId;
}
