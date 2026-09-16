import { z } from 'zod';
import {
    GEMINI_FALLBACK_MODELS,
    GEMINI_MODEL,
    getFriendlyModelName,
    getGeminiGenerateUrl,
} from '../geminiConfig';
import type { ModelAttempt } from '../types';
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
        })
        .optional(),
});

export class GeminiProviderClient implements AiProviderClient {
    readonly provider = 'gemini' as const;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey.trim();
    }

    async generate(options: AiGenerateOptions): Promise<AiGenerateResult> {
        if (!this.apiKey) {
            throw new Error('No API key provided for Google Gemini');
        }

        const timeoutMs = options.timeoutMs ?? 8000;
        const modelsToTry = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];
        const attempts: ModelAttempt[] = [];
        let lastErrorMessage = 'Unknown network error';

        for (let i = 0; i < modelsToTry.length; i++) {
            if (options.signal?.aborted) {
                throw new DOMException('Aborted by caller', 'AbortError');
            }

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
                // System instructions can be added to systemInstruction or prepended to prompt
                const bodyPayload: Record<string, unknown> = {
                    contents: [{ parts: [{ text: options.prompt }] }],
                    generationConfig: {
                        temperature: options.temperature ?? 0.2,
                        maxOutputTokens: 8192,
                        responseMimeType: 'application/json',
                        thinkingConfig: {
                            thinkingBudget: 0,
                        },
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
                    currentAttempt.status = 'failed';
                    currentAttempt.httpStatus = response.status;
                    currentAttempt.errorReason = response.status === 401 ? 'http-401' : response.status === 429 ? 'http-429' : 'http-5xx';
                    attempts.push(currentAttempt);

                    lastErrorMessage = envelope.success && envelope.data.error?.message
                        ? envelope.data.error.message
                        : `HTTP ${response.status}`;

                    if (response.status === 401) {
                        options.onProgress?.(currentAttempt, `${modelLabel}: API Key no válida (401)`);
                        throw new Error(`Gemini API 401 Unauthorized: ${lastErrorMessage}`);
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

                if (text && text.trim().length > 0) {
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
                lastErrorMessage = 'Empty or invalid response structure';

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
                    throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
                }
                if (err instanceof Error && err.message.includes('401')) {
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
