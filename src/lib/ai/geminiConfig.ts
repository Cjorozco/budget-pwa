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
 * `gemini-flash-latest` is Google’s generation-free Flash alias (tracks the current Flash).
 * Pinned version ids like gemini-2.5-flash 404 for new API keys.
 */
export const GEMINI_MODEL = 'gemini-flash-latest';

export const GEMINI_API_HOST = 'generativelanguage.googleapis.com';

export const GEMINI_GENERATE_URL =
    `https://${GEMINI_API_HOST}/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const GEMINI_TIMEOUT_MS = 2500;

export const GEMINI_KEY_STORAGE_KEY = 'budget_gemini_api_key';

export const GEMINI_KEY_HELP = {
    what: `API key de ${GEMINI_PROVIDER_LABEL}, creada en Google AI Studio. Sirve la gratuita o la de pago.`,
    whatNot:
        'Por ahora no sirven ChatGPT Plus, Claude.ai, ni keys de OpenAI (sk-…) o Anthropic: esta PWA no tiene servidor. Más adelante se pueden sumar otros proveedores que permitan llamada desde el navegador.',
    model: `Modelo fijo: ${GEMINI_MODEL} (Flash). No se elige otro desde la app.`,
} as const;
