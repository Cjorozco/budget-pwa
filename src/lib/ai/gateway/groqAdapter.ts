import { z } from 'zod';
import type { ModelAttempt } from '../types';
import type { AiGenerateOptions, AiGenerateResult, AiProviderClient, ConnectionTestResult } from './types';

export const GROQ_MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'groq/compound',
    'groq/compound-mini',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-safeguard-20b',
    'meta-llama/llama-prompt-guard-2-86m',
    'meta-llama/llama-prompt-guard-2-22m',
] as const;

export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GroqEnvelopeSchema = z.object({
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
            code: z.string().optional(),
        })
        .optional(),
});

export class GroqProviderClient implements AiProviderClient {
    readonly provider = 'groq' as const;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey.trim();
    }

    async generate(options: AiGenerateOptions): Promise<AiGenerateResult> {
        if (!this.apiKey) {
            throw new Error('No API key provided for Groq');
        }

        const timeoutMs = options.timeoutMs ?? 8000;
        const modelsToTry = [...GROQ_MODELS];
        const attempts: ModelAttempt[] = [];
        let lastErrorMessage = 'Unknown network error';

        for (let i = 0; i < modelsToTry.length; i++) {
            if (options.signal?.aborted) {
                throw new DOMException('Aborted by caller', 'AbortError');
            }

            const model = modelsToTry[i];
            const modelLabel = `Groq ${model}`;

            const currentAttempt: ModelAttempt = {
                provider: 'groq',
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

                const isGuardModel = model.includes('prompt-guard') || model.includes('safeguard');
                const maxTokens = isGuardModel ? 256 : Math.min(options.maxTokens ?? 512, 512);

                const messagesToSend = [...messages];
                if (!isGuardModel) {
                    const hasJsonWord = messagesToSend.some((m) => /json/i.test(m.content));
                    if (!hasJsonWord) {
                        messagesToSend.push({ role: 'system', content: 'Formato de respuesta requerido: JSON válido.' });
                    }
                }

                const requestBody: Record<string, unknown> = {
                    model,
                    messages: messagesToSend,
                    temperature: options.temperature ?? 0.1,
                    max_tokens: maxTokens,
                };

                if (!isGuardModel) {
                    requestBody.response_format = { type: 'json_object' };
                }

                const response = await fetch(GROQ_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    referrerPolicy: 'no-referrer',
                    signal: timeoutController.signal,
                    body: JSON.stringify(requestBody),
                });

                const json: unknown = await response.json().catch(() => null);
                const envelope = GroqEnvelopeSchema.safeParse(json);

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
                        throw new Error(`Groq API 401 Unauthorized: ${lastErrorMessage}`);
                    }

                    const nextModel = i < modelsToTry.length - 1 ? modelsToTry[i + 1] : null;
                    const failMsg = response.status === 429
                        ? `${modelLabel}: cuota agotada (429)${nextModel ? ` → Probando ${nextModel}…` : ''}`
                        : `${modelLabel}: error ${response.status}${nextModel ? ` → Probando ${nextModel}…` : ''}`;
                    options.onProgress?.(currentAttempt, failMsg);

                    if (i < modelsToTry.length - 1) {
                        continue;
                    }
                    throw new Error(`Groq request failed on all models (${response.status}): ${lastErrorMessage}`);
                }

                const content = envelope.success ? envelope.data.choices?.[0]?.message?.content : undefined;

                if (content && content.trim().length > 0) {
                    currentAttempt.status = 'success';
                    attempts.push(currentAttempt);
                    options.onProgress?.(currentAttempt, `Respuesta recibida de ${modelLabel}`);
                    return {
                        text: content,
                        modelUsed: model,
                        provider: 'groq',
                        attempts,
                    };
                }

                currentAttempt.status = 'failed';
                currentAttempt.errorReason = 'invalid-json';
                attempts.push(currentAttempt);
                lastErrorMessage = 'Empty response from Groq API';

                if (i < modelsToTry.length - 1) {
                    continue;
                }
                throw new Error(`Groq response was empty: ${lastErrorMessage}`);
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
                    throw new Error(`Groq request timed out after ${timeoutMs}ms`);
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

        throw new Error(`Groq generation failed: ${lastErrorMessage}`);
    }

    async testConnection(): Promise<ConnectionTestResult> {
        try {
            const result = await this.generate({
                prompt: 'Ping. Responde con un objeto JSON.',
                systemPrompt: 'Responde exclusivamente un objeto JSON válido: {"status":"ok"}',
                timeoutMs: 8000,
            });
            return {
                ok: true,
                message: `Conexión exitosa con Groq (${result.modelUsed})`,
                modelUsed: result.modelUsed,
                attempts: result.attempts,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error desconocido de conexión';
            return {
                ok: false,
                message: `No se pudo contactar a Groq: ${message}`,
            };
        }
    }
}
