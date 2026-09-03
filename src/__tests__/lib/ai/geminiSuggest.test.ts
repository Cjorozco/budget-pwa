import { describe, expect, it } from 'vitest';
import { parseLlmSuggestionJson, mapLlmPayloadToSuggestion, buildPrompt } from '@/lib/ai/geminiSuggest';
import { GEMINI_MODEL } from '@/lib/ai/geminiConfig';
import { db } from '@/lib/db';
import { beforeEach } from 'vitest';

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

describe('mapLlmPayloadToSuggestion', () => {
    beforeEach(async () => {
        await db.categories.clear();
        await db.categories.bulkAdd([
            { id: 'fin', name: 'Gastos financieros', type: 'expense', color: '#a855f7', usageCount: 0, isActive: true },
            { id: 'imp', name: 'Impuestos', type: 'expense', color: '#a855f7', parentId: 'fin', usageCount: 0, isActive: true },
        ]);
    });

    it('maps an existing catalog id and marks source gemini', async () => {
        const suggestion = await mapLlmPayloadToSuggestion(
            {
                match: 'existing',
                categoryId: 'imp',
                confidence: 0.91,
                reason: 'Declaración de renta',
            },
            'expense',
            new Set(['fin', 'imp'])
        );

        expect(suggestion?.categoryId).toBe('imp');
        expect(suggestion?.source).toBe('gemini');
        expect(suggestion?.categoryPath).toContain('Impuestos');
    });

    it('ignores an id that was not in the catalog sent to the model', async () => {
        const suggestion = await mapLlmPayloadToSuggestion(
            {
                match: 'existing',
                categoryId: 'forged',
                confidence: 0.99,
                reason: 'inventado',
            },
            'expense',
            new Set(['fin', 'imp'])
        );
        expect(suggestion).toBeNull();
    });

    it('maps create to needsCategoryCreation', async () => {
        const suggestion = await mapLlmPayloadToSuggestion(
            {
                match: 'create',
                categoryId: null,
                parentName: 'Gastos financieros',
                subcategoryName: 'Impuesto predial',
                confidence: 0.8,
                reason: 'Predial',
            },
            'expense',
            new Set(['fin', 'imp'])
        );

        expect(suggestion?.needsCategoryCreation).toBe(true);
        expect(suggestion?.pendingCategory).toEqual({
            type: 'expense',
            parentName: 'Gastos financieros',
            subcategoryName: 'Impuesto predial',
        });
        expect(suggestion?.source).toBe('gemini');
    });

    it('rejects creating a subcategory under a root parent that does not exist in rootParentNames', async () => {
        const suggestion = await mapLlmPayloadToSuggestion(
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

        expect(suggestion).toBeNull();
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
});

describe('gemini model constant', () => {
    it('uses the generation-free Flash alias', () => {
        expect(GEMINI_MODEL).toBe('gemini-flash-latest');
    });
});
