import { describe, expect, it } from 'vitest';
import {
    GenericLlmSuggestionSchema,
    extractJsonObject,
    parseGenericLlmSuggestion,
} from '@/lib/ai/contracts';

describe('GenericLlmSuggestionSchema (Provider-Agnostic Contract)', () => {
    it('validates and normalizes modern reasoning contract (reasoning -> reason, inferred match)', () => {
        const raw = {
            categoryId: 'cat-supermarket',
            confidence: 0.92,
            reasoning: 'Gasto frecuente en Éxito',
        };

        const parsed = GenericLlmSuggestionSchema.safeParse(raw);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.match).toBe('existing');
            expect(parsed.data.categoryId).toBe('cat-supermarket');
            expect(parsed.data.confidence).toBe(0.92);
            expect(parsed.data.reason).toBe('Gasto frecuente en Éxito');
        }
    });

    it('validates snake_case and alternative property names from OpenAI/Anthropic/Groq', () => {
        const raw = {
            category_id: 'cat-gas',
            score: 88,
            explanation: 'Pago de combustible Terpel',
        };

        const parsed = GenericLlmSuggestionSchema.safeParse(raw);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.match).toBe('existing');
            expect(parsed.data.categoryId).toBe('cat-gas');
            expect(parsed.data.confidence).toBe(0.88);
            expect(parsed.data.reason).toBe('Pago de combustible Terpel');
        }
    });

    it('infers match: create when parent_name and subcategory_name are provided', () => {
        const raw = {
            parent_name: 'Servicios',
            subcategory_name: 'Gas domiciliario',
            prob: '0.85',
            justification: 'Factura Vanti',
        };

        const parsed = GenericLlmSuggestionSchema.safeParse(raw);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.match).toBe('create');
            expect(parsed.data.parentName).toBe('Servicios');
            expect(parsed.data.subcategoryName).toBe('Gas domiciliario');
            expect(parsed.data.confidence).toBe(0.85);
            expect(parsed.data.reason).toBe('Factura Vanti');
        }
    });

    it('infers match: none when no categoryId or parentName is present', () => {
        const raw = {
            confidence: 0.1,
            reasoning: 'No se pudo asociar a ninguna categoría conocida',
        };

        const parsed = GenericLlmSuggestionSchema.safeParse(raw);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.match).toBe('none');
            expect(parsed.data.categoryId).toBeNull();
        }
    });

    it('rejects completely invalid schema violations (e.g. invalid confidence range)', () => {
        const raw = {
            match: 'existing',
            categoryId: 'cat-1',
            confidence: -5,
            reason: 'Invalido',
        };

        const parsed = GenericLlmSuggestionSchema.safeParse(raw);
        expect(parsed.success).toBe(false);
    });
});

describe('parseGenericLlmSuggestion', () => {
    it('parses raw and fenced JSON responses from any provider', () => {
        const jsonText = '```json\n{"category_id":"cat-123","confidence":0.9,"reasoning":"Compra supermercado"}\n```';
        const result = parseGenericLlmSuggestion(jsonText);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.payload.match).toBe('existing');
            expect(result.payload.categoryId).toBe('cat-123');
            expect(result.payload.reason).toBe('Compra supermercado');
        }
    });

    it('returns ok: false with reason invalid-json on malformed output', () => {
        const result = parseGenericLlmSuggestion('This is not json: { broken:');
        expect(result).toEqual({ ok: false, reason: 'invalid-json' });
    });
});

describe('extractJsonObject', () => {
    it('extracts plain json and fenced markdown blocks', () => {
        expect(extractJsonObject('{"foo":"bar"}')).toEqual({ foo: 'bar' });
        expect(extractJsonObject('```json\n{"foo":"bar"}\n```')).toEqual({ foo: 'bar' });
    });
});

