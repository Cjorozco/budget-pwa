import { z } from 'zod';
import type { ModelAttempt } from '../types';
import type { AiGenerateOptions, AiGenerateResult, AiProviderClient, ConnectionTestResult } from './types';

export const OPENAI_MODELS = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-3.5-turbo',
] as const;

export const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const OpenAiEnvelopeSchema = z.object({
    choices: z
        .array(
            z.object({
                message: z.object({
                    content: z.string().nullable().optional(),
                    role: z.string().optional(),
                }),
                finish_reason: z.string().optional(),
            })
        )
        .optional(),
    error: z
        .object({
            message: z.string().optional(),
            type: z.string().optional(),
            code: z.string().nullable().optional(),
        })
        .optional(),
});

export class OpenAiProviderClient implements AiProviderClient {
    readonly provider = 'openai' as const;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey.trim();
    }

    async generate(options: AiGenerateOptions): Promise<AiGenerateResult> {
        if (!this.apiKey) {
            throw new Error('No API key provided for OpenAI');
        }

        const timeoutMs = options.timeoutMs ?? 8000;
        const modelsToTry = [...OPENAI_MODELS];
        const attempts: ModelAttempt[] = [];
        let lastErrorMessage = 'Unknown network error';

        for (let i = 0; i < modelsToTry.length; i++) {
            if (options.signal?.aborted) {
                throw new DOMException('Aborted by caller', 'AbortError');
            }

            const model = modelsToTry[i];
            const modelLabel = model === 'gpt-4o-mini'
                ? 'GPT-4o Mini'
                : model === 'gpt-4o'
                ? 'GPT-4o'
                : `OpenAI (${model})`;

            const currentAttempt: ModelAttempt = {
                provider: 'openai',
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
                const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
                if (options.systemPrompt) {
                    messages.push({ role: 'system', content: options.systemPrompt });
                }
                messages.push({ role: 'user', content: options.prompt });

                const requestBody: Record<string, unknown> = {
                    model,
                    max_tokens: Math.min(options.maxTokens ?? 512, 1024),
                    temperature: options.temperature ?? 0.2,
                    messages,
                };

                // Enable json_object response format if json requested
                const hasJsonKeyword = messages.some((m) => /json/i.test(m.content));
                if (hasJsonKeyword) {
                    requestBody.response_format = { type: 'json_object' };
                }

                const response = await fetch(OPENAI_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify(requestBody),
                    signal: timeoutController.signal,
                });

                clearTimeout(timer);
                options.signal?.removeEventListener('abort', onParentAbort);

                const rawJson = await response.json().catch(() => null);
                const parsed = OpenAiEnvelopeSchema.safeParse(rawJson);

                if (!response.ok) {
                    const serverMsg =
                        parsed.success && parsed.data.error?.message
                            ? parsed.data.error.message
                            : `HTTP ${response.status} ${response.statusText}`;

                    currentAttempt.status = 'failed';
                    currentAttempt.httpStatus = response.status;
                    currentAttempt.errorReason = serverMsg;
                    attempts.push(currentAttempt);
                    lastErrorMessage = serverMsg;

                    // Fatal auth or billing error -> stop trying further models
                    if (response.status === 401 || response.status === 403) {
                        throw new Error(`Error de autenticación con OpenAI (${response.status}): ${serverMsg}`);
                    }
                    if (response.status === 429) {
                        // Rate limit / quota exceeded
                        lastErrorMessage = `Límite de cuota o tasa de OpenAI alcanzado (429): ${serverMsg}`;
                    }
                    continue;
                }

                if (!parsed.success) {
                    currentAttempt.status = 'failed';
                    currentAttempt.errorReason = 'Invalid response schema from OpenAI';
                    attempts.push(currentAttempt);
                    lastErrorMessage = 'Respuesta inesperada de OpenAI';
                    continue;
                }

                const choice = parsed.data.choices?.[0];
                const content = choice?.message?.content?.trim();

                if (!content) {
                    currentAttempt.status = 'failed';
                    currentAttempt.errorReason = 'Empty response content';
                    attempts.push(currentAttempt);
                    lastErrorMessage = 'OpenAI no devolvió texto en su respuesta.';
                    continue;
                }

                currentAttempt.status = 'success';
                attempts.push(currentAttempt);

                return {
                    text: content,
                    modelUsed: model,
                    provider: 'openai',
                    attempts,
                };
            } catch (err: unknown) {
                clearTimeout(timer);
                options.signal?.removeEventListener('abort', onParentAbort);

                if (options.signal?.aborted) {
                    throw new DOMException('Aborted by caller', 'AbortError');
                }

                const isAuthError = err instanceof Error && err.message.includes('autenticación');
                if (isAuthError) {
                    throw err;
                }

                currentAttempt.status = 'failed';
                currentAttempt.errorReason = isTimedOut
                    ? `Timeout tras ${timeoutMs}ms`
                    : err instanceof Error
                    ? err.message
                    : String(err);
                attempts.push(currentAttempt);
                lastErrorMessage = currentAttempt.errorReason;
            }
        }

        throw new Error(`OpenAI no pudo generar una sugerencia válida tras probar [${modelsToTry.join(', ')}]. Motivo: ${lastErrorMessage}`);
    }

    async testConnection(): Promise<ConnectionTestResult> {
        if (!this.apiKey) {
            return { ok: false, message: 'No se configuró API key para OpenAI.' };
        }

        try {
            const result = await this.generate({
                prompt: 'Responde exactamente: "OK"',
                timeoutMs: 8000,
                maxTokens: 10,
                temperature: 0,
            });

            return {
                ok: true,
                message: `Conexión exitosa con OpenAI (${result.modelUsed})`,
                modelUsed: result.modelUsed,
                attempts: result.attempts,
            };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
                ok: false,
                message: `Error de conexión con OpenAI: ${msg}`,
            };
        }
    }
}
