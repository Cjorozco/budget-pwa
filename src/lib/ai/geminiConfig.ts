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
 * Usamos gemini-3.1-pro-preview como modelo principal para aprovechar los límites ampliados
 * de suscripciones Pro y la mayor capacidad de razonamiento en clasificación estructurada.
 */
export const GEMINI_MODEL = 'gemini-3.1-pro-preview';

/**
 * Modelos de respaldo ordenados:
 * 1. Gemini 3.1 Flash Lite (preview ligero y rápido)
 * 2. Gemini 2.5 Flash (alta cuota, baja latencia, gran capacidad de categorización)
 * 3. Gemini 2.5 Flash Lite (ultra rápido y económico)
 * 4. Gemini 2.0 Flash
 * 5. Gemini 1.5 Flash
 */
export const GEMINI_FALLBACK_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
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
        'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
        'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
        'gemini-2.5-flash': 'Gemini 2.5 Flash',
        'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
        'gemini-2.0-flash': 'Gemini 2.0 Flash',
        'gemini-1.5-flash': 'Gemini 1.5 Flash',
    };
    return map[model] ?? model;
}

export const GEMINI_KEY_STORAGE_KEY = 'budget_gemini_api_key';

export const GEMINI_KEY_HELP = {
    what: `API key de ${GEMINI_PROVIDER_LABEL}, creada en Google AI Studio. Sirve la gratuita o la de pago.`,
    whatNot:
        'Por ahora no sirven ChatGPT Plus, Claude.ai, ni keys de OpenAI (sk-…) o Anthropic: esta PWA no tiene servidor. Más adelante se pueden sumar otros proveedores que permitan llamada desde el navegador.',
    model: `Modelo principal: ${GEMINI_MODEL} (con respaldo prioritario en Gemini 3.1 Flash Lite y familia Gemini 3+).`,
} as const;
