import { z } from 'zod';
import { getModelChain, getModelLabel, getModelSpec } from '../models';
import type { ModelAttempt } from '../types';
import type { AiGenerateOptions, AiGenerateResult, AiProviderClient, ConnectionTestResult } from './types';

export const ANTHROPIC_MODELS = getModelChain('anthropic').map((m) => m.id);

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const AnthropicEnvelopeSchema = z.object({
    id: z.string().optional(),
    type: z.string().optional(),
    role: z.string().optional(),
    content: z
        .array(
            z.object({
                type: z.string().optional(),
                text: z.string().optional(),
            })
        )
        .optional(),
    stop_reason: z.string().nullable().optional(),
    error: z
        .object({
            type: z.string().optional(),
            message: z.string().optional(),
        })
        .optional(),
});

export class AnthropicProviderClient implements AiProviderClient {
    readonly provider = 'anthropic' as const;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey.trim();
    }

    async generate(options: AiGenerateOptions): Promise<AiGenerateResult> {
        if (!this.apiKey) {
            throw new Error('No API key provided for Anthropic Claude');
        }

        const timeoutMs = options.timeoutMs ?? 8000;
        const modelsToTry = [...ANTHROPIC_MODELS];
        const attempts: ModelAttempt[] = [];
        let lastErrorMessage = 'Unknown network error';

        for (let i = 0; i < modelsToTry.length; i++) {
            if (options.signal?.aborted) {
                throw new DOMException('Aborted by caller', 'AbortError');
            }

            const model = modelsToTry[i];
            const modelLabel = getModelLabel('anthropic', model);

            const currentAttempt: ModelAttempt = {
                provider: 'anthropic',
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
                const requestBody: Record<string, unknown> = {
                    model,
                    max_tokens: Math.min(options.maxTokens ?? 512, 1024),
                    messages: [
                        { role: 'user', content: options.prompt },
                    ],
                };

                if (!getModelSpec('anthropic', model)?.omitTemperature) {
                    requestBody.temperature = options.temperature ?? 0.2;
                }

                if (options.systemPrompt) {
                    requestBody.system = options.systemPrompt;
                }

                const response = await fetch(ANTHROPIC_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    referrerPolicy: 'no-referrer',
                    signal: timeoutController.signal,
                    body: JSON.stringify(requestBody),
                });

                const json: unknown = await response.json().catch(() => null);
                const envelope = AnthropicEnvelopeSchema.safeParse(json);

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
                        throw new Error(`Anthropic API 401 Unauthorized: ${lastErrorMessage}`);
                    }

                    const nextModel = i < modelsToTry.length - 1 ? modelsToTry[i + 1] : null;
                    const failMsg = response.status === 429
                        ? `${modelLabel}: cuota agotada (429)${nextModel ? ` → Probando respaldo…` : ''}`
                        : `${modelLabel}: error ${response.status}${nextModel ? ` → Probando respaldo…` : ''}`;
                    options.onProgress?.(currentAttempt, failMsg);

                    if (i < modelsToTry.length - 1) {
                        continue;
                    }
                    throw new Error(`Anthropic request failed on all models (${response.status}): ${lastErrorMessage}`);
                }

                const textPart = envelope.success && envelope.data.content
                    ? envelope.data.content.find((p) => p.type === 'text')?.text ?? envelope.data.content[0]?.text
                    : undefined;

                if (textPart && textPart.trim().length > 0) {
                    currentAttempt.status = 'success';
                    attempts.push(currentAttempt);
                    options.onProgress?.(currentAttempt, `Respuesta recibida de ${modelLabel}`);
                    return {
                        text: textPart,
                        modelUsed: model,
                        provider: 'anthropic',
                        attempts,
                    };
                }

                currentAttempt.status = 'failed';
                currentAttempt.errorReason = 'invalid-json';
                attempts.push(currentAttempt);
                lastErrorMessage = 'Empty response from Anthropic API';

                if (i < modelsToTry.length - 1) {
                    continue;
                }
                throw new Error(`Anthropic response was empty: ${lastErrorMessage}`);
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
                    throw new Error(`Anthropic request timed out after ${timeoutMs}ms`);
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

        throw new Error(`Anthropic generation failed: ${lastErrorMessage}`);
    }

    async testConnection(): Promise<ConnectionTestResult> {
        try {
            const result = await this.generate({
                prompt: 'Ping. Responde exactamente con un JSON {"status":"ok"}',
                systemPrompt: 'Responde exclusivamente {"status":"ok"}',
                timeoutMs: 8000,
            });
            return {
                ok: true,
                message: `Conexión exitosa con Anthropic Claude (${result.modelUsed})`,
                modelUsed: result.modelUsed,
                attempts: result.attempts,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error desconocido de conexión';
            return {
                ok: false,
                message: `No se pudo contactar a Claude: ${message}`,
            };
        }
    }
}
