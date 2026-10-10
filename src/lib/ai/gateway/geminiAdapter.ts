import { z } from 'zod';
import {
    GEMINI_ATTEMPT_TIMEOUT_MS,
    GEMINI_FALLBACK_MODELS,
    GEMINI_MODEL,
    GEMINI_TOTAL_TIMEOUT_MS,
    getFriendlyModelName,
    getGeminiGenerateUrl,
    getGeminiThinkingLevel,
} from '../geminiConfig';
import type { ModelAttempt } from '../types';
import { AiProviderError, toAiProviderError } from './errors';
import type { AiGenerateOptions, AiGenerateResult, AiProviderClient, ConnectionTestResult } from './types';

const GeminiApiEnvelopeSchema = z.object({
    candidates: z
        .array(
            z.object({
                finishReason: z.string().optional(),
                content: z
                    .object({
                        parts: z.array(z.object({ text: z.string().optional() })).optional(),
                    })
                    .optional(),
            })
        )
        .optional(),
    error: z
        .object({
            message: z.string().optional(),
            code: z.number().optional(),
            status: z.string().optional(),
            details: z.array(z.object({ reason: z.string().optional() }).passthrough()).optional(),
        })
        .optional(),
});

/** Overrides for non-production uses such as the evaluation harness (one model, longer timeouts). */
export interface GeminiClientConfig {
    /** Replaces the default chain; the first model is tried first. */
    models?: readonly string[];
    timeoutMs?: number;
    totalTimeoutMs?: number;
}

export class GeminiProviderClient implements AiProviderClient {
    readonly provider = 'gemini' as const;
    private apiKey: string;

    private readonly config: GeminiClientConfig;

    constructor(apiKey: string, config: GeminiClientConfig = {}) {
        this.apiKey = apiKey.trim();
        this.config = config;
    }

    async generate(options: AiGenerateOptions): Promise<AiGenerateResult> {
        const attempts: ModelAttempt[] = [];
        try {
            return await this.run(options, attempts);
        } catch (err) {
            throw toAiProviderError(err, attempts);
        }
    }

    private async run(options: AiGenerateOptions, attempts: ModelAttempt[]): Promise<AiGenerateResult> {
        if (!this.apiKey) {
            throw new Error('No API key provided for Google Gemini');
        }

        const startedAt = Date.now();
        const totalMs = options.totalTimeoutMs ?? this.config.totalTimeoutMs ?? GEMINI_TOTAL_TIMEOUT_MS;
        const perAttemptMs = options.timeoutMs ?? this.config.timeoutMs ?? GEMINI_ATTEMPT_TIMEOUT_MS;
        const modelsToTry = this.config.models ? [...this.config.models] : [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];
        let lastErrorMessage = 'Unknown network error';
        // A rejected schema must never cost the whole suggestion: after one 400 we retry without it.
        let schemaEnabled = Boolean(options.responseSchema);

        for (let i = 0; i < modelsToTry.length; i++) {
            if (options.signal?.aborted) {
                throw new DOMException('Aborted by caller', 'AbortError');
            }

            const remainingMs = totalMs - (Date.now() - startedAt);
            if (remainingMs <= 0) {
                throw new Error(`Gemini request timeout: ${totalMs}ms budget exhausted`);
            }
            const timeoutMs = Math.min(perAttemptMs, remainingMs);

            const model = modelsToTry[i];
            const modelLabel = getFriendlyModelName(model);
            const url = getGeminiGenerateUrl(model);

            const currentAttempt: ModelAttempt = {
                provider: 'gemini',
                model,
                modelLabel,
                status: 'trying',
            };
            options.onProgress?.(currentAttempt, `Probando ${modelLabel}…`);

            const timeoutController = new AbortController();
            let isTimedOut = false;
            const timer = setTimeout(() => {
                isTimedOut = true;
                timeoutController.abort();
            }, timeoutMs);

            const onParentAbort = () => timeoutController.abort();
            options.signal?.addEventListener('abort', onParentAbort);

            try {
                // temperature/top_p/top_k are deprecated for Gemini 3+, so they are not sent.
                const thinkingLevel = getGeminiThinkingLevel(model);
                const bodyPayload: Record<string, unknown> = {
                    contents: [{ parts: [{ text: options.prompt }] }],
                    generationConfig: {
                        maxOutputTokens: 8192,
                        responseMimeType: 'application/json',
                        ...(schemaEnabled ? { responseSchema: options.responseSchema } : {}),
                        ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
                    },
                };

                if (options.systemPrompt) {
                    bodyPayload.systemInstruction = {
                        parts: [{ text: options.systemPrompt }],
                    };
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': this.apiKey,
                    },
                    referrerPolicy: 'no-referrer',
                    signal: timeoutController.signal,
                    body: JSON.stringify(bodyPayload),
                });

                const json: unknown = await response.json().catch(() => null);
                const envelope = GeminiApiEnvelopeSchema.safeParse(json);

                if (!response.ok) {
                    // Gemini answers a bad key with 400 + API_KEY_INVALID (not 401), so look at the body too.
                    const apiError = envelope.success ? envelope.data.error : undefined;
                    const isInvalidKey =
                        response.status === 401 ||
                        response.status === 403 ||
                        (response.status === 400 &&
                            (Boolean(apiError?.details?.some((d) => d.reason === 'API_KEY_INVALID')) ||
                                /API key not valid/i.test(apiError?.message ?? '')));

                    currentAttempt.status = 'failed';
                    currentAttempt.httpStatus = response.status;
                    currentAttempt.errorReason = isInvalidKey
                        ? 'http-401'
                        : response.status === 429
                        ? 'http-429'
                        : response.status >= 500
                        ? 'http-5xx'
                        : `http-${response.status}`;
                    attempts.push(currentAttempt);

                    lastErrorMessage = envelope.success && envelope.data.error?.message
                        ? envelope.data.error.message
                        : `HTTP ${response.status}`;

                    if (response.status === 400 && schemaEnabled && !isInvalidKey) {
                        schemaEnabled = false;
                        attempts.pop();
                        options.onProgress?.(currentAttempt, `${modelLabel}: esquema no aceptado → reintentando sin esquema…`);
                        i--;
                        continue;
                    }

                    if (isInvalidKey) {
                        options.onProgress?.(currentAttempt, `${modelLabel}: API Key no válida`);
                        throw new AiProviderError(`Gemini API key rejected (${response.status}): ${lastErrorMessage}`, 'http-401', attempts);
                    }

                    const nextModel = i < modelsToTry.length - 1 ? getFriendlyModelName(modelsToTry[i + 1]) : null;
                    const failMsg = response.status === 429
                        ? `${modelLabel}: cuota agotada (429)${nextModel ? ` → Probando ${nextModel}…` : ''}`
                        : `${modelLabel}: error ${response.status}${nextModel ? ` → Probando ${nextModel}…` : ''}`;
                    options.onProgress?.(currentAttempt, failMsg);

                    if (i < modelsToTry.length - 1) {
                        continue;
                    }
                    throw new Error(`Gemini request failed on all models (${response.status}): ${lastErrorMessage}`);
                }

                const candidate = envelope.success ? envelope.data.candidates?.[0] : undefined;
                const text = candidate?.content?.parts?.[0]?.text;

                const isTruncated = candidate?.finishReason === 'MAX_TOKENS';

                if (!isTruncated && text && text.trim().length > 0) {
                    currentAttempt.status = 'success';
                    attempts.push(currentAttempt);
                    options.onProgress?.(currentAttempt, `Respuesta recibida de ${modelLabel}`);
                    return {
                        text,
                        modelUsed: model,
                        provider: 'gemini',
                        attempts,
                    };
                }

                currentAttempt.status = 'failed';
                currentAttempt.errorReason = 'invalid-json';
                attempts.push(currentAttempt);
                lastErrorMessage = isTruncated ? 'Response truncated (MAX_TOKENS)' : 'Empty or invalid response structure';

                if (i < modelsToTry.length - 1) {
                    continue;
                }
                throw new Error(`Gemini response was empty: ${lastErrorMessage}`);
            } catch (err: unknown) {
                if (options.signal?.aborted) {
                    throw new DOMException('Aborted by caller', 'AbortError');
                }
                if (isTimedOut) {
                    currentAttempt.status = 'failed';
                    currentAttempt.errorReason = 'timeout';
                    attempts.push(currentAttempt);
                    lastErrorMessage = 'Timeout';
                    if (i < modelsToTry.length - 1) continue;
                    throw new Error(`Gemini request timeout after ${timeoutMs}ms`);
                }
                if (err instanceof AiProviderError || (err instanceof Error && err.message.includes('401'))) {
                    throw err;
                }
                currentAttempt.status = 'failed';
                currentAttempt.errorReason = 'network-error';
                attempts.push(currentAttempt);
                if (i < modelsToTry.length - 1) continue;
                throw err instanceof Error ? err : new Error(String(err));
            } finally {
                clearTimeout(timer);
                options.signal?.removeEventListener('abort', onParentAbort);
            }
        }

        throw new Error(`Gemini generation failed: ${lastErrorMessage}`);
    }

    async testConnection(): Promise<ConnectionTestResult> {
        try {
            const result = await this.generate({
                prompt: 'Ping',
                systemPrompt: 'Responde exclusivamente {"status":"ok"}',
                timeoutMs: 8000,
                totalTimeoutMs: 20000,
            });
            return {
                ok: true,
                message: `Conexión exitosa con Google Gemini (${getFriendlyModelName(result.modelUsed)})`,
                modelUsed: result.modelUsed,
                attempts: result.attempts,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error desconocido de conexión';
            return {
                ok: false,
                message: `No se pudo contactar a Gemini: ${message}`,
            };
        }
    }
}
