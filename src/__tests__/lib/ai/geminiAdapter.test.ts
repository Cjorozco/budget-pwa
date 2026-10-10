import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiProviderClient } from '@/lib/ai/gateway';
import { GEMINI_FALLBACK_MODELS, GEMINI_MODEL } from '@/lib/ai/geminiConfig';

const OK_JSON = '{"match":"none","categoryId":null,"confidence":0,"reason":"ok"}';

function okResponse(text: string, finishReason = 'STOP'): Response {
    return new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }), { status: 200 });
}

function errorResponse(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: { code: status, message } }), { status });
}

describe('GeminiProviderClient model chain', () => {
    it('starts with gemini-3.5-flash-lite and keeps the documented fallbacks', () => {
        expect(GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
        expect(GEMINI_FALLBACK_MODELS).toEqual(['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']);
    });
});

describe('GeminiProviderClient request body', () => {
    afterEach(() => vi.restoreAllMocks());

    it('never sends deprecated sampling/thinking params and sets thinkingLevel per model', async () => {
        const bodies: Array<Record<string, unknown>> = [];
        const urls: string[] = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
            urls.push(String(url));
            bodies.push(JSON.parse(String((init as RequestInit).body)));
            return bodies.length < 3 ? errorResponse(503, 'high demand') : okResponse(OK_JSON);
        });

        await new GeminiProviderClient('test-key').generate({ prompt: 'p', systemPrompt: 's', temperature: 0.9 });

        expect(urls[0]).toContain('/models/gemini-3.5-flash-lite:');
        expect(urls[2]).toContain('/models/gemini-3.6-flash:');
        for (const body of bodies) {
            const cfg = body.generationConfig as Record<string, unknown>;
            for (const banned of ['temperature', 'topP', 'topK', 'candidateCount']) {
                expect(cfg).not.toHaveProperty(banned);
            }
            expect(cfg.thinkingConfig).not.toHaveProperty('thinkingBudget');
            // A request must never end on a "model" turn.
            const contents = body.contents as Array<{ role?: string }>;
            expect(contents[contents.length - 1].role).not.toBe('model');
        }
        expect((bodies[0].generationConfig as { thinkingConfig: unknown }).thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
        expect((bodies[2].generationConfig as { thinkingConfig: unknown }).thinkingConfig).toEqual({ thinkingLevel: 'medium' });
    });
});

describe('GeminiProviderClient resilience & errors', () => {
    afterEach(() => vi.restoreAllMocks());

    it('tries fallback model when primary model returns 503 high demand', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(errorResponse(503, 'This model is currently experiencing high demand.'))
            .mockResolvedValueOnce(okResponse(OK_JSON));
        const progress: string[] = [];

        const result = await new GeminiProviderClient('test-key').generate({
            prompt: 'p',
            onProgress: (_attempt, msg) => progress.push(msg),
        });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(result.text).toBe(OK_JSON);
        expect(result.attempts?.map((a) => a.status)).toEqual(['failed', 'success']);
        expect(progress.length).toBeGreaterThan(0);
    });

    it('tries fallback model when primary model returns 404 model no longer available', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(errorResponse(404, 'This model is no longer available to new users.'))
            .mockResolvedValueOnce(okResponse(OK_JSON));

        const result = await new GeminiProviderClient('test-key').generate({ prompt: 'p' });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(result.text).toBe(OK_JSON);
    });

    it('cascades past 429 and a hanging attempt to succeed on the 3rd model', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(errorResponse(429, 'Resource has been exhausted.'))
            .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 100)))
            .mockResolvedValueOnce(okResponse('{"match":"existing","categoryId":"cat-1"}'));

        const result = await new GeminiProviderClient('test-key').generate({ prompt: 'p', timeoutMs: 20, totalTimeoutMs: 5000 });

        expect(fetchSpy).toHaveBeenCalledTimes(3);
        expect(result.attempts).toHaveLength(3);
        expect(result.attempts?.[0]).toMatchObject({ status: 'failed', httpStatus: 429 });
        expect(result.attempts?.[1]).toMatchObject({ status: 'failed', errorReason: 'timeout' });
        expect(result.attempts?.[2].status).toBe('success');
    });

    it('stops on 401 without trying fallback models', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(errorResponse(401, 'API key not valid.'));

        await expect(new GeminiProviderClient('bad-key').generate({ prompt: 'p' })).rejects.toThrow(/401/);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws a 429 error when quota is exhausted on all models', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => errorResponse(429, 'Resource has been exhausted.'));

        await expect(new GeminiProviderClient('test-key').generate({ prompt: 'p' })).rejects.toThrow(/429/);
        expect(fetchSpy).toHaveBeenCalledTimes(1 + GEMINI_FALLBACK_MODELS.length);
    });

    it('throws a 500 error when it persists across all models', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => errorResponse(500, 'Internal error.'));

        await expect(new GeminiProviderClient('test-key').generate({ prompt: 'p' })).rejects.toThrow(/500/);
    });

    it('throws a timeout error when every attempt times out', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50)));

        await expect(new GeminiProviderClient('test-key').generate({ prompt: 'p', timeoutMs: 10 })).rejects.toThrow(/timeout/);
    });

    it('stops after the total budget instead of walking the whole chain', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 200)));

        await expect(
            new GeminiProviderClient('test-key').generate({ prompt: 'p', timeoutMs: 40, totalTimeoutMs: 100 })
        ).rejects.toThrow(/timeout/);
        expect(fetchSpy.mock.calls.length).toBeLessThan(1 + GEMINI_FALLBACK_MODELS.length);
    });

    it('throws a network error when fetch keeps failing', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch'));

        await expect(new GeminiProviderClient('test-key').generate({ prompt: 'p' })).rejects.toThrow('Failed to fetch');
    });

    it('moves to the next model when the response is truncated with MAX_TOKENS', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(okResponse('{"match', 'MAX_TOKENS'))
            .mockResolvedValueOnce(okResponse(OK_JSON));

        const result = await new GeminiProviderClient('test-key').generate({ prompt: 'p' });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(result.text).toBe(OK_JSON);
        expect(result.attempts?.map((a) => a.status)).toEqual(['failed', 'success']);
    });
});
