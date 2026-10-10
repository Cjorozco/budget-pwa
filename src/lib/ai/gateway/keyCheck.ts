import type { AiProviderType } from '../types';

/**
 * Lightweight API key check: asks the provider to list its models, which authenticates the key
 * without generating text, so it does not spend usage quota. The key goes only to that provider.
 *
 * - valid:   the provider recognized the key.
 * - invalid: the provider rejected the key.
 * - unknown: we could not tell (offline, timeout, CORS, unexpected answer). Never treated as invalid.
 */
export type KeyCheckStatus = 'valid' | 'invalid' | 'unknown';

export interface KeyCheckResult {
    status: KeyCheckStatus;
    httpStatus?: number;
}

export const KEY_CHECK_TIMEOUT_MS = 8000;

interface KeyCheckRequest {
    url: string;
    headers: Record<string, string>;
}

function buildRequest(provider: AiProviderType, apiKey: string): KeyCheckRequest | null {
    switch (provider) {
        case 'gemini':
            return {
                url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
                headers: { 'x-goog-api-key': apiKey },
            };
        case 'openai':
            return {
                url: 'https://api.openai.com/v1/models',
                headers: { Authorization: `Bearer ${apiKey}` },
            };
        case 'anthropic':
            return {
                url: 'https://api.anthropic.com/v1/models?limit=1',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
            };
        case 'groq':
            return {
                url: 'https://api.groq.com/openai/v1/models',
                headers: { Authorization: `Bearer ${apiKey}` },
            };
        default:
            return null;
    }
}

/** Gemini answers a bad key with 400 + API_KEY_INVALID instead of 401. */
async function isGeminiInvalidKeyBody(response: Response): Promise<boolean> {
    try {
        const body = (await response.json()) as { error?: { message?: string; details?: Array<{ reason?: string }> } };
        return (
            Boolean(body.error?.details?.some((d) => d.reason === 'API_KEY_INVALID')) ||
            /API key not valid/i.test(body.error?.message ?? '')
        );
    } catch {
        return false;
    }
}

export async function checkApiKey(
    provider: AiProviderType,
    apiKey: string,
    signal?: AbortSignal
): Promise<KeyCheckResult> {
    const request = buildRequest(provider, apiKey.trim());
    if (!request) return { status: 'unknown' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), KEY_CHECK_TIMEOUT_MS);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener('abort', onParentAbort);

    try {
        const response = await fetch(request.url, {
            method: 'GET',
            headers: request.headers,
            referrerPolicy: 'no-referrer',
            signal: controller.signal,
        });

        if (response.ok) return { status: 'valid', httpStatus: response.status };
        // Rate limited means the key was authenticated.
        if (response.status === 429) return { status: 'valid', httpStatus: response.status };
        if (response.status === 401 || response.status === 403) return { status: 'invalid', httpStatus: response.status };
        if (provider === 'gemini' && response.status === 400 && (await isGeminiInvalidKeyBody(response))) {
            return { status: 'invalid', httpStatus: response.status };
        }
        return { status: 'unknown', httpStatus: response.status };
    } catch {
        return { status: 'unknown' };
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onParentAbort);
    }
}
