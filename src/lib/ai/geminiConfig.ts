import { getModelChain, getModelLabel, getModelSpec, type GeminiThinkingLevel } from './models';

/**
 * First cloud provider for the optional categorizer.
 * There is no backend today, so the client can only call APIs that allow browser CORS.
 * Gemini is that provider now; others (Groq, OpenRouter, etc.) can plug into suggestWithLlm later.
 * ChatGPT Plus / Claude.ai subscriptions are NOT API keys.
 */
export const GEMINI_PROVIDER_LABEL = 'Google Gemini';

/** Google AI Studio — create a Gemini API key (free tier or billed). */
export const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey';

/**
 * Model chain comes from models.ts (single source of truth).
 * GEMINI_MODEL is tried first; GEMINI_FALLBACK_MODELS follow in order.
 */
export const GEMINI_MODEL = getModelChain('gemini')[0].id;

export const GEMINI_FALLBACK_MODELS = getModelChain('gemini').slice(1).map((m) => m.id);

export const GEMINI_API_HOST = 'generativelanguage.googleapis.com';

export function getGeminiGenerateUrl(model: string = GEMINI_MODEL): string {
    return `https://${GEMINI_API_HOST}/v1beta/models/${model}:generateContent`;
}

export const GEMINI_GENERATE_URL = getGeminiGenerateUrl(GEMINI_MODEL);

/** Overall budget for the whole Gemini chain; when it runs out the local engine takes over. */
export const GEMINI_TOTAL_TIMEOUT_MS = 8000;
export const GEMINI_TIMEOUT_MS = 6000;
export const GEMINI_ATTEMPT_TIMEOUT_MS = 6000;

export function getFriendlyModelName(model: string): string {
    return getModelLabel('gemini', model);
}

/** thinkingLevel for a Gemini model, as declared in models.ts. */
export function getGeminiThinkingLevel(model: string): GeminiThinkingLevel | undefined {
    return getModelSpec('gemini', model)?.thinkingLevel;
}

export const GEMINI_KEY_STORAGE_KEY = 'budget_gemini_api_key';

export const GEMINI_KEY_HELP = {
    what: `API key de ${GEMINI_PROVIDER_LABEL}, creada en Google AI Studio. Sirve la gratuita o la de pago.`,
    whatNot:
        'Por ahora no sirven ChatGPT Plus, Claude.ai, ni keys de OpenAI (sk-…) o Anthropic: esta PWA no tiene servidor.',
    model: `Modelo principal: ${getFriendlyModelName(GEMINI_MODEL)} (con respaldo en Flash Lite 3.1 → Flash 3.6 → 3.8).`,
} as const;
