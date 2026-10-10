import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    parseLlmSuggestion,
    parseLlmSuggestionJson,
    mapLlmPayloadToSuggestion,
    buildPrompt,
    sanitizePii,
} from '@/lib/ai/geminiSuggest';
import { db } from '@/lib/db';
import { setGeminiApiKey } from '@/lib/ai/geminiKey';
import { suggestCategoryWithLlm } from '@/lib/ai/suggestWithLlm';
import { suggestWithAiProvider } from '@/lib/ai/geminiSuggest';

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

    it('extracts JSON surrounded by conversational text', () => {
        const payload = parseLlmSuggestionJson(
            'Claro, aquí tienes la sugerencia:\n{"match":"existing","categoryId":"cat-99","parentName":null,"subcategoryName":null,"confidence":0.85,"reason":"Gasto frecuente"}\nEspero te sirva!'
        );
        expect(payload?.match).toBe('existing');
        expect(payload?.categoryId).toBe('cat-99');
        expect(payload?.confidence).toBe(0.85);
    });

    it('normalizes percentage confidence (e.g. 85 -> 0.85) and string numbers', () => {
        const payload1 = parseLlmSuggestionJson(
            '{"match":"existing","categoryId":"cat-1","confidence":85,"reason":"Alimentación"}'
        );
        expect(payload1?.confidence).toBe(0.85);

        const payload2 = parseLlmSuggestionJson(
            '{"match":"existing","categoryId":"cat-1","confidence":"0.95","reason":"Alimentación"}'
        );
        expect(payload2?.confidence).toBe(0.95);
    });

    it('trims string properties and caps length safely', () => {
        const payload = parseLlmSuggestionJson(
            '{"match":"create","parentName":"   Hogar   ","subcategoryName":"  Servicios  ","confidence":0.8,"reason":"  Gasto de servicios del hogar  "}'
        );
        expect(payload?.parentName).toBe('Hogar');
        expect(payload?.subcategoryName).toBe('Servicios');
        expect(payload?.reason).toBe('Gasto de servicios del hogar');
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

    it('returns ok: false with rejected: invalid-schema when reason is empty', () => {
        const res = parseLlmSuggestion('{"match":"existing","categoryId":"cat-1","confidence":0.8,"reason":"   "}');
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

describe('end-to-end resilience integration (fallback to local heuristic/regex engine)', () => {
    beforeEach(async () => {
        setGeminiApiKey('test-valid-api-key');
        await db.categories.clear();
        await db.transactions.clear();
        await db.categories.bulkAdd([
            { id: 'cat-serv', name: 'Servicios básicos', type: 'expense', color: '#3b82f6', usageCount: 0, isActive: true },
            { id: 'cat-luz', name: 'Electricidad', type: 'expense', color: '#3b82f6', parentId: 'cat-serv', usageCount: 0, isActive: true },
            { id: 'cat-diarios', name: 'Gastos diarios', type: 'expense', color: '#10b981', usageCount: 0, isActive: true },
            { id: 'cat-super', name: 'Supermercado', type: 'expense', color: '#10b981', parentId: 'cat-diarios', usageCount: 0, isActive: true },
        ]);
    });

    it('handles a network drop (network-error) and transparently falls back to local regex/rule engine without blocking the UI', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch'));

        const result = await suggestCategoryWithLlm('Pago recibo de Enel Codensa', 'expense', {
            isPro: true,
            online: true,
        });

        // 1. La UI no se bloquea ni lanza excepción
        expect(result.status).toBe('success');
        if (result.status === 'success') {
            // 2. Se activó el fallback al motor local determinista
            expect(result.source).toBe('local');
            expect(result.suggestion.categoryId).toBe('cat-luz');
            expect(result.suggestion.categoryPath).toContain('Electricidad');
            // 3. El diagnóstico registra el error de red para telemetría/UI sin romper
            expect(result.geminiDiagnosis?.status).toBe('error');
            if (result.geminiDiagnosis?.status === 'error') {
                expect(result.geminiDiagnosis.reason).toBe('network-error');
            }
        }

        fetchSpy.mockRestore();
    });

    it('rejects invalid or hallucinated AI responses with Zod and falls back seamlessly to local engine', async () => {
        // Simular que el modelo responde con un categoryId alucinado que no existe en el catálogo de IndexedDB
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: JSON.stringify({
                                            match: 'existing',
                                            categoryId: 'uuid-alucinado-que-no-existe-en-db',
                                            confidence: 0.95,
                                            reason: 'Alucinación de IA',
                                        }),
                                    },
                                ],
                            },
                        },
                    ],
                }),
                { status: 200 }
            )
        );

        const result = await suggestCategoryWithLlm('Mercado en Carulla', 'expense', {
            isPro: true,
            online: true,
        });

        // 1. Zod + Grounding rechazaron el ID inexistente
        expect(result.status).toBe('success');
        if (result.status === 'success') {
            // 2. Fallback automático al motor local
            expect(result.source).toBe('local');
            expect(result.suggestion.categoryId).toBe('cat-super');
            expect(result.suggestion.categoryPath).toContain('Supermercado');
            // 3. Diagnóstico tipado de rechazo
            expect(result.geminiDiagnosis?.status).toBe('rejected');
            if (result.geminiDiagnosis?.status === 'rejected') {
                expect(result.geminiDiagnosis.reason).toBe('invalid-category-id');
            }
        }

        fetchSpy.mockRestore();
    });

    it('rejects malformed non-JSON / broken syntax from AI and falls back seamlessly to local engine', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [{ text: '<<<Error 500: broken payload {match: invalid' }],
                            },
                        },
                    ],
                }),
                { status: 200 }
            )
        );

        const result = await suggestCategoryWithLlm('Mercado en Carulla', 'expense', {
            isPro: true,
            online: true,
        });

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.source).toBe('local');
            expect(result.suggestion.categoryId).toBe('cat-super');
            expect(result.geminiDiagnosis?.status).toBe('rejected');
            if (result.geminiDiagnosis?.status === 'rejected') {
                expect(result.geminiDiagnosis.reason).toBe('invalid-json');
            }
        }

        fetchSpy.mockRestore();
    });
});

describe('suggestWithAiProvider request shape', () => {
    beforeEach(async () => {
        setGeminiApiKey('test-valid-api-key');
        await db.categories.clear();
        await db.transactions.clear();
        await db.categories.bulkAdd([
            { id: 'cat-diarios', name: 'Gastos diarios', type: 'expense', color: '#10b981', usageCount: 0, isActive: true },
            { id: 'cat-super', name: 'Supermercado', type: 'expense', color: '#10b981', parentId: 'cat-diarios', usageCount: 0, isActive: true },
        ]);
    });

    it('sends the stable rules as system prompt and a schema restricted to the user categories', async () => {
        let body: Record<string, unknown> = {};
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
            body = JSON.parse(String((init as RequestInit).body));
            return new Response(JSON.stringify({
                candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"match":"existing","categoryId":"cat-super","confidence":0.95,"reason":"Compra de mercado"}' }] } }],
            }), { status: 200 });
        });

        const result = await suggestWithAiProvider('mercado Éxito', 'expense');

        expect(result.status).toBe('success');
        const system = (body.systemInstruction as { parts: Array<{ text: string }> }).parts[0].text;
        expect(system).toContain('PRIORIDAD TOTAL A CATEGORÍAS EXISTENTES');
        const schema = (body.generationConfig as { responseSchema: { properties: Record<string, { enum?: string[] }> } }).responseSchema;
        expect(schema.properties.categoryId.enum).toEqual(expect.arrayContaining(['cat-diarios', 'cat-super']));
        expect(schema.properties.parentName.enum).toEqual(['Gastos diarios']);
        const userText = (body.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts[0].text;
        expect(userText).toContain('cat-super | Gastos diarios › Supermercado');
        fetchSpy.mockRestore();
    });
});
