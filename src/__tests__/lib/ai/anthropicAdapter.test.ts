import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ANTHROPIC_API_URL,
    AnthropicProviderClient,
} from '@/lib/ai/gateway/anthropicAdapter';
import { parseGenericLlmSuggestion } from '@/lib/ai/contracts';
import { validateProviderKey } from '@/lib/ai/gateway/config';

describe('AnthropicProviderClient (REST Adapter)', () => {
    const mockApiKey = 'sk-ant-api03-test-anthropic-key-1234567890';
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('sends direct browser Anthropic message request with appropriate headers and system prompt', async () => {
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
                    id: 'msg_123',
                    type: 'message',
                    role: 'assistant',
                    content: [
                        {
                            type: 'text',
                            text: '{"match":"existing","categoryId":"cat-ant-1","confidence":0.96,"reason":"Aporte a inversión en CDT para generar rendimientos"}'
                        }
                    ],
                }),
            };
        });

        const client = new AnthropicProviderClient(mockApiKey);
        const result = await client.generate({
            prompt: 'Inversión en CDT Bancolombia $5000000',
            systemPrompt: 'Eres un asesor financiero experto.',
            timeoutMs: 5000,
        });

        expect(capturedUrl).toBe(ANTHROPIC_API_URL);
        expect(capturedHeaders['x-api-key']).toBe(mockApiKey);
        expect(capturedHeaders['anthropic-version']).toBe('2023-06-01');
        expect(capturedHeaders['anthropic-dangerous-direct-browser-access']).toBe('true');
        expect(capturedHeaders['Content-Type']).toBe('application/json');

        expect(capturedBody.system).toBe('Eres un asesor financiero experto.');
        const messages = capturedBody.messages as Array<{ role: string; content: string }>;
        expect(messages[0].content).toContain('Inversión en CDT Bancolombia');

        expect(result.provider).toBe('anthropic');
        expect(result.text).toContain('cat-ant-1');

        const parsed = parseGenericLlmSuggestion(result.text);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.payload.categoryId).toBe('cat-ant-1');
            expect(parsed.payload.reason).toContain('CDT');
        }
    });

    it('handles 401 Unauthorized without useless fallbacks', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({
                error: { type: 'authentication_error', message: 'invalid x-api-key' }
            }),
        });

        const client = new AnthropicProviderClient(mockApiKey);
        await expect(client.generate({ prompt: 'test' })).rejects.toThrow(/401/i);
    });

    it('tries fallback model on 429 rate limit / quota', async () => {
        let callCount = 0;
        globalThis.fetch = vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return {
                    ok: false,
                    status: 429,
                    json: async () => ({ error: { type: 'rate_limit_error', message: 'Rate limit exceeded' } }),
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    content: [{ type: 'text', text: '{"match":"none","categoryId":null,"confidence":0,"reason":"ok"}' }],
                }),
            };
        });

        const client = new AnthropicProviderClient(mockApiKey);
        const result = await client.generate({ prompt: 'test' });
        expect(callCount).toBe(2);
        expect(result.attempts?.length).toBe(2);
        expect(result.attempts?.[0].status).toBe('failed');
        expect(result.attempts?.[1].status).toBe('success');
    });

    it('tests connection successfully with Claude', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                content: [{ type: 'text', text: '{"status":"ok"}' }],
            }),
        });

        const client = new AnthropicProviderClient(mockApiKey);
        const testRes = await client.testConnection();
        expect(testRes.ok).toBe(true);
        expect(testRes.message).toContain('Anthropic Claude');
    });

    it('validates provider keys strictly', () => {
        expect(validateProviderKey('anthropic', '')).toMatch(/Pega una API key válida/i);
        expect(validateProviderKey('anthropic', 'AIzaSy123456789012345')).toMatch(/Google Gemini/i);
        expect(validateProviderKey('anthropic', 'gsk_123456789012345')).toMatch(/Groq/i);
        expect(validateProviderKey('anthropic', 'sk-ant-short')).toMatch(/incompleta/i);
        expect(validateProviderKey('anthropic', 'sk-ant-api03-valid-length-key-123456789')).toBeNull();
    });
});
