import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AI_SELECTED_PROVIDER_STORAGE_KEY,
    clearAiApiKey,
    createAiClient,
    executeAiPrompt,
    GeminiProviderClient,
    getAiApiKey,
    getSelectedAiProvider,
    GROQ_API_URL,
    GroqProviderClient,
    hasAiApiKey,
    maskApiKey,
    setAiApiKey,
    setSelectedAiProvider,
    UNIFIED_SYSTEM_PROMPT,
} from '@/lib/ai/gateway';
import { parseGenericLlmSuggestion } from '@/lib/ai/contracts';

describe('AI Gateway Configuration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('defaults to gemini provider when none set', () => {
        expect(getSelectedAiProvider()).toBe('gemini');
    });

    it('saves and reads selected provider', () => {
        setSelectedAiProvider('groq');
        expect(getSelectedAiProvider()).toBe('groq');
        expect(localStorage.getItem(AI_SELECTED_PROVIDER_STORAGE_KEY)).toBe('groq');
    });

    it('manages provider API keys in localStorage', () => {
        setAiApiKey('gemini', 'test-gemini-key-12345');
        expect(getAiApiKey('gemini')).toBe('test-gemini-key-12345');
        expect(hasAiApiKey('gemini')).toBe(true);

        setAiApiKey('groq', 'gsk_test_groq_key_67890');
        expect(getAiApiKey('groq')).toBe('gsk_test_groq_key_67890');
        expect(hasAiApiKey('groq')).toBe(true);

        clearAiApiKey('gemini');
        expect(hasAiApiKey('gemini')).toBe(false);
        expect(getAiApiKey('gemini')).toBeNull();
    });

    it('masks keys appropriately', () => {
        expect(maskApiKey('12345')).toBe('••••');
        expect(maskApiKey('AIzaSyD1234567890ABCDEF')).toBe('AIza…CDEF');
    });
});

describe('AI Client Factory', () => {
    it('creates Gemini client with valid key', () => {
        const client = createAiClient('gemini', 'my-gemini-key');
        expect(client.provider).toBe('gemini');
        expect(client).toBeInstanceOf(GeminiProviderClient);
    });

    it('creates Groq client with valid key', () => {
        const client = createAiClient('groq', 'gsk_my-groq-key');
        expect(client.provider).toBe('groq');
        expect(client).toBeInstanceOf(GroqProviderClient);
    });

    it('throws error when no API key is available', () => {
        localStorage.clear();
        expect(() => createAiClient('gemini', null)).toThrow(/No API key/i);
    });

    it('throws error for unsupported provider', () => {
        // @ts-expect-error testing unsupported provider
        expect(() => createAiClient('unknown-provider', 'some-key')).toThrow(/Unsupported/i);
    });
});

describe('GeminiProviderClient (REST Adapter)', () => {
    const mockApiKey = 'AIzaSyFakeGeminiKey12345';
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('sends REST request with thinkingBudget: 0 and json mime type', async () => {
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
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: '{"match":"existing","categoryId":"cat-1","confidence":0.95,"reason":"Mercado"}',
                                    },
                                ],
                            },
                        },
                    ],
                }),
            };
        });

        const client = new GeminiProviderClient(mockApiKey);
        const result = await client.generate({
            prompt: 'Gasto de supermercado Éxito',
            systemPrompt: 'Responde JSON',
            timeoutMs: 5000,
        });

        expect(capturedUrl).toContain('generativelanguage.googleapis.com');
        expect(capturedHeaders['x-goog-api-key']).toBe(mockApiKey);
        expect(capturedHeaders['Content-Type']).toBe('application/json');

        const genConfig = capturedBody.generationConfig as { responseMimeType: string; thinkingConfig: { thinkingBudget: number } };
        expect(genConfig.responseMimeType).toBe('application/json');
        expect(genConfig.thinkingConfig.thinkingBudget).toBe(0);

        expect(result.provider).toBe('gemini');
        expect(result.text).toContain('"match":"existing"');

        // Verify result is valid JSON for Zod
        const parsed = parseGenericLlmSuggestion(result.text);
        expect(parsed.ok).toBe(true);
    });

    it('handles 401 Unauthorized by stopping immediate retry', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: { message: 'API key not valid' } }),
        });

        const client = new GeminiProviderClient(mockApiKey);
        await expect(client.generate({ prompt: 'test' })).rejects.toThrow(/401/i);
    });

    it('tests connection successfully', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                candidates: [
                    { content: { parts: [{ text: '{"status":"ok"}' }] } },
                ],
            }),
        });

        const client = new GeminiProviderClient(mockApiKey);
        const testRes = await client.testConnection();
        expect(testRes.ok).toBe(true);
        expect(testRes.message).toContain('Google Gemini');
    });
});

describe('GroqProviderClient (REST Adapter)', () => {
    const mockGroqKey = 'gsk_test_groq_key_12345';
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('sends OpenAI-compatible chat completion payload with system prompt', async () => {
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
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: '{"match":"existing","categoryId":"cat-groq-1","confidence":0.92,"reason":"Gasolina"}',
                            },
                        },
                    ],
                }),
            };
        });

        const client = new GroqProviderClient(mockGroqKey);
        const result = await client.generate({
            prompt: 'Tanqueo Texaco $100000',
            systemPrompt: 'System instructions here',
            timeoutMs: 5000,
        });

        expect(capturedUrl).toBe(GROQ_API_URL);
        expect(capturedHeaders['Authorization']).toBe(`Bearer ${mockGroqKey}`);

        const messages = capturedBody.messages as Array<{ role: string; content: string }>;
        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({ role: 'system', content: 'System instructions here' });
        expect(messages[1]).toEqual({ role: 'user', content: 'Tanqueo Texaco $100000' });

        expect(result.provider).toBe('groq');
        expect(result.text).toContain('cat-groq-1');

        const parsed = parseGenericLlmSuggestion(result.text);
        expect(parsed.ok).toBe(true);
    });

    it('tests connection successfully with Groq', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                choices: [
                    { message: { content: '{"status":"ok"}' } },
                ],
            }),
        });

        const client = new GroqProviderClient(mockGroqKey);
        const testRes = await client.testConnection();
        expect(testRes.ok).toBe(true);
        expect(testRes.message).toContain('Groq');
    });
});

describe('AI Gateway Orchestrator', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        localStorage.clear();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('injects UNIFIED_SYSTEM_PROMPT and returns plain text ready for Zod', async () => {
        setSelectedAiProvider('gemini');
        setAiApiKey('gemini', 'test-key-orchestrator');

        let systemInstructionCaptured: unknown = null;

        globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
            const body = JSON.parse(init.body as string);
            systemInstructionCaptured = body.systemInstruction;

            return {
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: '{"match":"create","parentName":"Transporte","subcategoryName":"Peajes","confidence":0.88,"reason":"Peaje autopista"}',
                                    },
                                ],
                            },
                        },
                    ],
                }),
            };
        });

        const result = await executeAiPrompt('Peaje autopista norte');
        expect(result.provider).toBe('gemini');
        expect(systemInstructionCaptured).toEqual({
            parts: [{ text: UNIFIED_SYSTEM_PROMPT }],
        });

        // Test upper layer Zod parsing
        const parsed = parseGenericLlmSuggestion(result.text);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.payload.match).toBe('create');
            expect(parsed.payload.parentName).toBe('Transporte');
            expect(parsed.payload.subcategoryName).toBe('Peajes');
        }
    });

    it('throws when no API key configured for the provider', async () => {
        setSelectedAiProvider('groq');
        clearAiApiKey('groq');

        await expect(executeAiPrompt('Hola')).rejects.toThrow(/No API key configured/i);
    });
});
