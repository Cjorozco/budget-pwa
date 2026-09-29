import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    OPENAI_API_URL,
    OpenAiProviderClient,
} from '@/lib/ai/gateway/openaiAdapter';
import { parseGenericLlmSuggestion } from '@/lib/ai/contracts';
import { validateProviderKey } from '@/lib/ai/gateway/config';

describe('OpenAiProviderClient (REST Adapter)', () => {
    const mockApiKey = 'sk-proj-test-openai-key-1234567890abcdefghijklmnopqrstuvwxyz';
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('sends direct OpenAI chat completions request with Authorization header and json_object response format', async () => {
        let capturedUrl = '';
        let capturedHeaders: Record<string, string> = {};
        let capturedBody: Record<string, unknown> = {};

        globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
            capturedUrl = url;
            capturedHeaders = init.headers as Record<string, string>;
            capturedBody = JSON.parse(init.body as string);

            return {
                ok: true,
                status: 200,
                json: async () => ({
                    id: 'chatcmpl-123',
                    object: 'chat.completion',
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: '{"match":"existing","categoryId":"cat-openai-1","confidence":0.95,"reason":"Pago de suscripción mensual"}'
                            }
                        }
                    ],
                }),
            };
        });

        const client = new OpenAiProviderClient(mockApiKey);
        const result = await client.generate({
            prompt: 'Netflix mensual $45000',
            systemPrompt: 'Eres un clasificador contable.',
            timeoutMs: 5000,
        });

        expect(capturedUrl).toBe(OPENAI_API_URL);
        expect(capturedHeaders['Authorization']).toBe(`Bearer ${mockApiKey}`);
        expect(capturedHeaders['Content-Type']).toBe('application/json');

        const messages = capturedBody.messages as Array<{ role: string; content: string }>;
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toBe('Eres un clasificador contable.');
        expect(messages[1].role).toBe('user');
        expect(messages[1].content).toContain('Netflix mensual');

        expect(result.provider).toBe('openai');
        expect(result.text).toContain('cat-openai-1');

        const parsed = parseGenericLlmSuggestion(result.text);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.payload.categoryId).toBe('cat-openai-1');
            expect(parsed.payload.reason).toContain('suscripción');
        }
    });

    it('handles 401 Unauthorized without useless fallbacks', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({
                error: { message: 'Incorrect API key provided', type: 'invalid_request_error' }
            }),
        });

        const client = new OpenAiProviderClient(mockApiKey);
        await expect(client.generate({ prompt: 'test' })).rejects.toThrow(/401/i);
    });

    it('tries fallback model on 429 rate limit or quota exceed', async () => {
        let callCount = 0;
        globalThis.fetch = vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return {
                    ok: false,
                    status: 429,
                    json: async () => ({ error: { message: 'Rate limit reached', type: 'requests' } }),
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: '{"match":"none","categoryId":null,"confidence":0,"reason":"ok"}'
                            }
                        }
                    ],
                }),
            };
        });

        const client = new OpenAiProviderClient(mockApiKey);
        const result = await client.generate({ prompt: 'test' });
        expect(callCount).toBe(2);
        expect(result.attempts?.length).toBe(2);
        expect(result.attempts?.[0].status).toBe('failed');
        expect(result.attempts?.[1].status).toBe('success');
    });

    it('tests connection successfully with OpenAI', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: '{"status":"ok"}'
                        }
                    }
                ],
            }),
        });

        const client = new OpenAiProviderClient(mockApiKey);
        const testRes = await client.testConnection();
        expect(testRes.ok).toBe(true);
        expect(testRes.message).toContain('OpenAI');
    });

    it('validates provider keys strictly', () => {
        expect(validateProviderKey('openai', '')).toMatch(/Pega una API key válida/i);
        expect(validateProviderKey('openai', 'AIzaSy123456789012345')).toMatch(/Google Gemini/i);
        expect(validateProviderKey('openai', 'gsk_123456789012345')).toMatch(/Groq/i);
        expect(validateProviderKey('openai', 'sk-ant-123456789012345')).toMatch(/Anthropic/i);
        expect(validateProviderKey('openai', 'sk-short')).toMatch(/incompleta/i);
        expect(validateProviderKey('openai', 'sk-proj-valid-length-key-12345678901234567890')).toBeNull();
    });
});
