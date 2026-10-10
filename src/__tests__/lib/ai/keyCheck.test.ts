import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkApiKey } from '@/lib/ai/gateway/keyCheck';

const json = (status: number, body: unknown = {}): Response => new Response(JSON.stringify(body), { status });

describe('checkApiKey', () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([
        ['gemini', 'generativelanguage.googleapis.com/v1beta/models', 'x-goog-api-key', 'key-1'],
        ['openai', 'api.openai.com/v1/models', 'Authorization', 'Bearer key-1'],
        ['anthropic', 'api.anthropic.com/v1/models', 'x-api-key', 'key-1'],
        ['groq', 'api.groq.com/openai/v1/models', 'Authorization', 'Bearer key-1'],
    ] as const)('%s: lists models with the key and never generates text', async (provider, urlPart, header, value) => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { models: [] }));

        const result = await checkApiKey(provider, ' key-1 ');

        expect(result).toEqual({ status: 'valid', httpStatus: 200 });
        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain(urlPart);
        expect(String(url)).not.toContain('generateContent');
        expect((init as RequestInit).method).toBe('GET');
        expect(((init as RequestInit).headers as Record<string, string>)[header]).toBe(value);
        expect((init as RequestInit).body).toBeUndefined();
    });

    it('never puts the key in the URL', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200));
        await checkApiKey('gemini', 'SECRET-KEY-123');
        expect(String(spy.mock.calls[0][0])).not.toContain('SECRET-KEY-123');
    });

    it('anthropic sends the browser-access headers', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200));
        await checkApiKey('anthropic', 'sk-ant-x');
        const headers = (spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
        expect(headers['anthropic-version']).toBe('2023-06-01');
        expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    });

    it('reports invalid for 401 and 403', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(401));
        expect((await checkApiKey('openai', 'k')).status).toBe('invalid');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(403));
        expect((await checkApiKey('groq', 'k')).status).toBe('invalid');
    });

    it('gemini: 400 API_KEY_INVALID is invalid, other 400s are unknown', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            json(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } })
        );
        expect((await checkApiKey('gemini', 'k')).status).toBe('invalid');

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(400, { error: { message: 'Bad request' } }));
        expect((await checkApiKey('gemini', 'k')).status).toBe('unknown');
    });

    it('a rate-limited key is still a valid key', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(429));
        expect((await checkApiKey('gemini', 'k')).status).toBe('valid');
    });

    it('never calls a failed check invalid: network errors, timeouts and server errors are unknown', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
        expect((await checkApiKey('openai', 'k')).status).toBe('unknown');

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(503));
        expect((await checkApiKey('openai', 'k')).status).toBe('unknown');

        vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) =>
            new Promise((_resolve, reject) => {
                (init as RequestInit).signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
            })
        );
        const controller = new AbortController();
        const pending = checkApiKey('openai', 'k', controller.signal);
        controller.abort();
        expect((await pending).status).toBe('unknown');
    });

    it('does nothing for providers without a known endpoint', async () => {
        const spy = vi.spyOn(globalThis, 'fetch');
        expect((await checkApiKey('ollama', 'k')).status).toBe('unknown');
        expect(spy).not.toHaveBeenCalled();
    });
});
