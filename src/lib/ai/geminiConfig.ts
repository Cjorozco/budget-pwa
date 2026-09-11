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
 * Arrancamos con un modelo base veloz y de alta disponibilidad (gemini-2.5-flash)
 * para minimizar saturaciones y errores 503 por alta demanda.
 */
export const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Modelos de respaldo ordenados de menor a mayor (desde modelos estables y ligeros,
 * pasando por modelos Pro de razonamiento profundo, hasta la familia Gemini 3).
 * Todos priorizan salida de texto estructurado en JSON.
 */
export const GEMINI_FALLBACK_MODELS = [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.1-pro-preview',
    'gemini-flash-latest',
] as const;

export const GEMINI_API_HOST = 'generativelanguage.googleapis.com';

export function getGeminiGenerateUrl(model: string = GEMINI_MODEL): string {
    return `https://${GEMINI_API_HOST}/v1beta/models/${model}:generateContent`;
}

export const GEMINI_GENERATE_URL = getGeminiGenerateUrl(GEMINI_MODEL);

export const GEMINI_TIMEOUT_MS = 6000;

export const GEMINI_KEY_STORAGE_KEY = 'budget_gemini_api_key';

export const GEMINI_KEY_HELP = {
    what: `API key de ${GEMINI_PROVIDER_LABEL}, creada en Google AI Studio. Sirve la gratuita o la de pago.`,
    whatNot:
        'Por ahora no sirven ChatGPT Plus, Claude.ai, ni keys de OpenAI (sk-…) o Anthropic: esta PWA no tiene servidor. Más adelante se pueden sumar otros proveedores que permitan llamada desde el navegador.',
    model: `Modelo principal: ${GEMINI_MODEL} (con respaldo automático en modelos Flash y Pro). No se elige otro desde la app.`,
} as const;
