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
 * Model id sent to generateContent.
 * Usamos gemini-3.1-flash-lite como modelo principal para velocidad máxima y bajo costo/cuota,
 * escalando a través de la familia Flash de menor a mayor.
 */
export const GEMINI_MODEL = 'gemini-3.1-flash-lite';

/**
 * Modelos de respaldo ordenados de menor a mayor dentro del ecosistema Gemini Flash:
 * 1. Gemini 3.5 Flash Lite
 * 2. Gemini 3.6 Flash
 * 3. Gemini 3.7 Flash
 * 4. Gemini 3.8 Flash
 */
export const GEMINI_FALLBACK_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
] as const;

export const GEMINI_API_HOST = 'generativelanguage.googleapis.com';

export function getGeminiGenerateUrl(model: string = GEMINI_MODEL): string {
    return `https://${GEMINI_API_HOST}/v1beta/models/${model}:generateContent`;
}

export const GEMINI_GENERATE_URL = getGeminiGenerateUrl(GEMINI_MODEL);

export const GEMINI_TIMEOUT_MS = 6000;
export const GEMINI_ATTEMPT_TIMEOUT_MS = 6000;

export function getFriendlyModelName(model: string): string {
    const map: Record<string, string> = {
        'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
        'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
        'gemini-3.6-flash': 'Gemini 3.6 Flash',
        'gemini-3.7-flash': 'Gemini 3.7 Flash',
        'gemini-3.8-flash': 'Gemini 3.8 Flash',
    };
    return map[model] ?? model;
}

export const GEMINI_KEY_STORAGE_KEY = 'budget_gemini_api_key';

export const GEMINI_KEY_HELP = {
    what: `API key de ${GEMINI_PROVIDER_LABEL}, creada en Google AI Studio. Sirve la gratuita o la de pago.`,
    whatNot:
        'Por ahora no sirven ChatGPT Plus, Claude.ai, ni keys de OpenAI (sk-…) o Anthropic: esta PWA no tiene servidor.',
    model: `Modelo principal: ${GEMINI_MODEL} (con respaldo en Flash 3.5 → 3.6 → 3.7 → 3.8).`,
} as const;
