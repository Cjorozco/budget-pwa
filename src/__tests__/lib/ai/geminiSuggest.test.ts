import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    parseLlmSuggestion,
    parseLlmSuggestionJson,
    mapLlmPayloadToSuggestion,
    buildPrompt,
    sanitizePii,
    generateGeminiText,
    suggestWithGemini,
} from '@/lib/ai/geminiSuggest';
import { GEMINI_FALLBACK_MODELS, GEMINI_MODEL } from '@/lib/ai/geminiConfig';
import { db } from '@/lib/db';
import { clearGeminiApiKey } from '@/lib/ai/geminiKey';

describe('parseLlmSuggestionJson', () => {
    it('parses a raw JSON object', () => {
        const payload = parseLlmSuggestionJson(
            '{"match":"existing","categoryId":"cat-1","parentName":null,"subcategoryName":null,"confidence":0.9,"reason":"Supermercado"}'
        );
        expect(payload?.match).toBe('existing');
        expect(payload?.categoryId).toBe('cat-1');
    });

    it('parses fenced JSON', () => {
        const payload = parseLlmSuggestionJson(
            '```json\n{"match":"none","categoryId":null,"parentName":null,"subcategoryName":null,"confidence":0.1,"reason":"nada"}\n```'
        );
        expect(payload?.match).toBe('none');
    });

    it('returns null for garbage', () => {
        expect(parseLlmSuggestionJson('not json')).toBeNull();
        expect(parseLlmSuggestionJson('{"match":"nope"}')).toBeNull();
    });
});

describe('parseLlmSuggestion (typed results)', () => {
    it('returns ok: true with payload for valid JSON', () => {
        const res = parseLlmSuggestion('{"match":"existing","categoryId":"cat-1","parentName":null,"subcategoryName":null,"confidence":0.9,"reason":"Supermercado"}');
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.payload.match).toBe('existing');
            expect(res.payload.categoryId).toBe('cat-1');
        }
    });

    it('returns ok: false with rejected: invalid-json on corrupted or truncated JSON', () => {
        const res = parseLlmSuggestion('{"match":"existing","cat');
        expect(res).toEqual({
            ok: false,
            result: { status: 'rejected', reason: 'invalid-json' },
        });
    });

    it('returns ok: false with rejected: invalid-schema when payload violates schema', () => {
        const res = parseLlmSuggestion('{"match":"invalid_match_type","confidence":2.5}');
        expect(res).toEqual({
            ok: false,
            result: { status: 'rejected', reason: 'invalid-schema' },
        });
    });
});

describe('mapLlmPayloadToSuggestion', () => {
    beforeEach(async () => {
        await db.categories.clear();
        await db.categories.bulkAdd([
            { id: 'fin', name: 'Gastos financieros', type: 'expense', color: '#a855f7', usageCount: 0, isActive: true },
            { id: 'imp', name: 'Impuestos', type: 'expense', color: '#a855f7', parentId: 'fin', usageCount: 0, isActive: true },
        ]);
    });

    it('maps an existing catalog id and returns success with source gemini', async () => {
        const result = await mapLlmPayloadToSuggestion(
            {
                match: 'existing',
                categoryId: 'imp',
                confidence: 0.91,
                reason: 'Declaración de renta',
            },
            'expense',
            new Set(['fin', 'imp'])
        );

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.suggestion.categoryId).toBe('imp');
            expect(result.suggestion.source).toBe('gemini');
            expect(result.suggestion.categoryPath).toContain('Impuestos');
        }
    });

    it('returns no-match when model returns match: none', async () => {
        const result = await mapLlmPayloadToSuggestion(
            {
                match: 'none',
                categoryId: null,
                parentName: null,
                subcategoryName: null,
                confidence: 0.1,
                reason: 'No coincide con nada',
            },
            'expense',
            new Set(['fin', 'imp'])
        );

        expect(result).toEqual({ status: 'no-match', reason: 'model-none' });
    });

    it('returns rejected invalid-category-id when id is not in catalog and name does not match', async () => {
        const result = await mapLlmPayloadToSuggestion(
            {
                match: 'existing',
                categoryId: 'forged',
                confidence: 0.99,
                reason: 'inventado',
            },
            'expense',
            new Set(['fin', 'imp'])
        );

        expect(result).toEqual({ status: 'rejected', reason: 'invalid-category-id' });
    });

    it('maps create to needsCategoryCreation with status success', async () => {
        const result = await mapLlmPayloadToSuggestion(
            {
                match: 'create',
                categoryId: null,
                parentName: 'Gastos financieros',
                subcategoryName: 'Impuesto predial',
                confidence: 0.8,
                reason: 'Predial',
            },
            'expense',
            new Set(['fin', 'imp']),
            new Set(['gastos financieros'])
        );

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.suggestion.needsCategoryCreation).toBe(true);
            expect(result.suggestion.pendingCategory).toEqual({
                type: 'expense',
                parentName: 'Gastos financieros',
                subcategoryName: 'Impuesto predial',
            });
            expect(result.suggestion.source).toBe('gemini');
        }
    });

    it('rejects creating a subcategory when parentName is missing (rejected: invalid-schema)', async () => {
        const result = await mapLlmPayloadToSuggestion(
            {
                match: 'create',
                categoryId: null,
                parentName: null,
                subcategoryName: 'Transporte',
                confidence: 0.85,
                reason: 'Sin padre',
            },
            'expense',
            new Set(['fin', 'imp']),
            new Set(['gastos financieros'])
        );

        expect(result).toEqual({ status: 'rejected', reason: 'invalid-schema' });
    });

    it('rejects creating a subcategory under a root parent that does not exist in rootParentNames (rejected: unknown-root)', async () => {
        const result = await mapLlmPayloadToSuggestion(
            {
                match: 'create',
                categoryId: null,
                parentName: 'Niños',
                subcategoryName: 'Transporte',
                confidence: 0.85,
                reason: 'Transporte niños',
            },
            'expense',
            new Set(['fin', 'imp']),
            new Set(['gastos financieros']) // User only has Gastos financieros, not Niños
        );

        expect(result).toEqual({ status: 'rejected', reason: 'unknown-root' });
    });

    it('maps to existing subcategory when Gemini proposes parentName matching an active child category', async () => {
        const result = await mapLlmPayloadToSuggestion(
            {
                match: 'create',
                categoryId: null,
                parentName: 'Impuestos',
                subcategoryName: 'Predial',
                confidence: 0.88,
                reason: 'Impuesto predial',
            },
            'expense',
            new Set(['fin', 'imp']),
            new Set(['gastos financieros'])
        );

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.suggestion.categoryId).toBe('imp');
            expect(result.suggestion.needsCategoryCreation).toBe(false);
        }
    });
});

describe('suggestWithGemini', () => {
    it('returns unavailable: no-api-key when no API key is set', async () => {
        clearGeminiApiKey();
        const result = await suggestWithGemini('almuerzo', 'expense');
        expect(result).toEqual({ status: 'unavailable', reason: 'no-api-key' });
    });
});

describe('sanitizePii', () => {
    it('replaces email addresses and numbers >= 6 digits', () => {
        expect(sanitizePii('Pago a test@example.com CC 1020304050')).toBe('Pago a [EMAIL] CC [NUM]');
        expect(sanitizePii('Compra por $50 en tienda')).toBe('Compra por $50 en tienda');
    });
});

describe('buildPrompt', () => {
    it('includes user custom category guidance and recent transaction examples', () => {
        const prompt = buildPrompt(
            'Uber al jardín',
            'expense',
            [
                { id: 'sofia', path: 'Sofía', isLeaf: false },
                { id: 'ruta', path: 'Sofía › Ruta', isLeaf: true },
            ],
            [{ description: 'Ruta escolar', categoryPath: 'Sofía › Ruta' }]
        );

        expect(prompt).toContain('Sofía');
        expect(prompt).toContain('Ruta escolar');
        expect(prompt).toContain('PRIORIDAD TOTAL A CATEGORÍAS EXISTENTES');
        expect(prompt).toContain('Uber al jardín');
    });

    it('sanitizes PII in description and recent transaction examples', () => {
        const prompt = buildPrompt(
            'Transferencia a 1032456789 juan@gmail.com',
            'expense',
            [{ id: 'trans', path: 'Transferencias', isLeaf: true }],
            [{ description: 'Pago de nómina a 987654321', categoryPath: 'Nómina' }]
        );

        expect(prompt).not.toContain('1032456789');
        expect(prompt).not.toContain('juan@gmail.com');
        expect(prompt).not.toContain('987654321');
        expect(prompt).toContain('[NUM]');
        expect(prompt).toContain('[EMAIL]');
    });
});

describe('gemini model constant', () => {
    it('uses gemini-3.6-flash as the primary baseline workhorse', () => {
        expect(GEMINI_MODEL).toBe('gemini-3.6-flash');
    });
});

describe('generateGeminiText resilience & errors', () => {
    it('tries fallback model when primary model returns 503 high demand', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify({
                error: { code: 503, message: 'This model is currently experiencing high demand.' }
            }), { status: 503 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                candidates: [{ content: { parts: [{ text: '{"match":"none","categoryId":null}' }] } }]
            }), { status: 200 }));

        const result = await generateGeminiText({
            apiKey: 'test-key',
            prompt: 'test prompt',
        });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ ok: true, text: '{"match":"none","categoryId":null}' });
        fetchSpy.mockRestore();
    });

    it('tries fallback model when primary model returns 404 model no longer available', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify({
                error: { code: 404, message: 'This model is no longer available to new users.' }
            }), { status: 404 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                candidates: [{ content: { parts: [{ text: '{"match":"none","categoryId":null}' }] } }]
            }), { status: 200 }));

        const result = await generateGeminiText({
            apiKey: 'test-key',
            prompt: 'test prompt',
        });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ ok: true, text: '{"match":"none","categoryId":null}' });
        fetchSpy.mockRestore();
    });

    it('returns error http-401 immediately on invalid API key without fallback loop', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify({
                error: { code: 401, message: 'API key not valid.' }
            }), { status: 401 }));

        const result = await generateGeminiText({
            apiKey: 'bad-key',
            prompt: 'test prompt',
        });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ ok: false, result: { status: 'error', reason: 'http-401' } });
        fetchSpy.mockRestore();
    });

    it('returns error http-429 when rate limit exhausted across all models', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response(JSON.stringify({
                error: { code: 429, message: 'Resource has been exhausted.' }
            }), { status: 429 }));

        const result = await generateGeminiText({
            apiKey: 'test-key',
            prompt: 'test prompt',
        });

        expect(result).toEqual({ ok: false, result: { status: 'error', reason: 'http-429' } });
        fetchSpy.mockRestore();
    });

    it('returns error http-5xx when 500 error persists across all models', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response(JSON.stringify({
                error: { code: 500, message: 'Internal error.' }
            }), { status: 500 }));

        const result = await generateGeminiText({
            apiKey: 'test-key',
            prompt: 'test prompt',
        });

        expect(result).toEqual({ ok: false, result: { status: 'error', reason: 'http-5xx' } });
        fetchSpy.mockRestore();
    });

    it('returns error timeout when request times out', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50)));

        const result = await generateGeminiText({
            apiKey: 'test-key',
            prompt: 'test prompt',
            timeoutMs: 10,
        });

        expect(result).toEqual({ ok: false, result: { status: 'error', reason: 'timeout' } });
        fetchSpy.mockRestore();
    });

    it('returns error network-error when network fetch throws', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('Failed to fetch'));

        const result = await generateGeminiText({
            apiKey: 'test-key',
            prompt: 'test prompt',
        });

        expect(result).toEqual({ ok: false, result: { status: 'error', reason: 'network-error' } });
        fetchSpy.mockRestore();
    });
});

describe('gemini fallback models', () => {
    it('includes stable Flash, Pro models and Gemini 3 family as progressive fallbacks', () => {
        expect(GEMINI_FALLBACK_MODELS).toContain('gemini-3.5-flash');
        expect(GEMINI_FALLBACK_MODELS).toContain('gemini-3.5-flash-lite');
        expect(GEMINI_FALLBACK_MODELS).toContain('gemini-3.1-flash-lite');
        expect(GEMINI_FALLBACK_MODELS).toContain('gemini-2.5-pro');
        expect(GEMINI_FALLBACK_MODELS).toContain('gemini-3.7-flash');
        expect(GEMINI_FALLBACK_MODELS).toContain('gemini-3.8-flash');
        expect(GEMINI_FALLBACK_MODELS).toContain('gemini-3.1-pro-preview');
        expect(GEMINI_FALLBACK_MODELS).toContain('gemini-flash-latest');
        expect(GEMINI_FALLBACK_MODELS).not.toContain('gemini-2.5-flash');
    });
});
