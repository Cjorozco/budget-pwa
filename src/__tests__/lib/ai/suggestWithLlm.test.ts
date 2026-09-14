import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldCallGemini, suggestCategoryWithLlm } from '@/lib/ai/suggestWithLlm';
import type { CategorySuggestion } from '@/lib/ai/categorizer';
import { setGeminiApiKey, clearGeminiApiKey } from '@/lib/ai/geminiKey';

vi.mock('@/lib/ai/categorizer', async () => {
    const actual = await vi.importActual<typeof import('@/lib/ai/categorizer')>('@/lib/ai/categorizer');
    return {
        ...actual,
        suggestCategory: vi.fn(),
    };
});

vi.mock('@/lib/ai/geminiSuggest', () => ({
    suggestWithGemini: vi.fn(),
    sanitizePii: (t: string) => t,
}));

import { suggestCategory } from '@/lib/ai/categorizer';
import { suggestWithGemini } from '@/lib/ai/geminiSuggest';

const strongLocal: CategorySuggestion = {
    categoryId: 'luz',
    categoryPath: 'Servicios básicos › Electricidad',
    confidence: 0.78,
    reason: 'Encaja',
    needsCategoryCreation: false,
};

const weakLocal: CategorySuggestion = {
    categoryId: 'fin',
    categoryPath: 'Gastos financieros',
    confidence: 0.62,
    reason: 'Empate',
    needsCategoryCreation: false,
    alternatives: [{ categoryId: 'per', categoryPath: 'Gastos personales' }],
};

const sofiaRopaLocal: CategorySuggestion = {
    categoryId: 'sofia-ropa',
    categoryPath: 'Sofia › Ropa',
    confidence: 0.85,
    reason: 'Regla local para ropa de Sofia',
    needsCategoryCreation: false,
};

const hogarOtrosLocal: CategorySuggestion = {
    categoryId: 'hogar-otros',
    categoryPath: 'Hogar › Otros',
    confidence: 0.8,
    reason: 'Regla local de mantenimiento del hogar',
    needsCategoryCreation: false,
};

describe('shouldCallGemini', () => {
    it('skips a strong leaf match', () => {
        expect(shouldCallGemini(strongLocal)).toBe(false);
    });

    it('calls when there is no local match or it is weak', () => {
        expect(shouldCallGemini(null)).toBe(true);
        expect(shouldCallGemini(weakLocal)).toBe(true);
        expect(shouldCallGemini({ ...strongLocal, needsCategoryCreation: true, categoryId: null })).toBe(true);
    });
});

describe('suggestCategoryWithLlm', () => {
    beforeEach(() => {
        clearGeminiApiKey();
        vi.mocked(suggestCategory).mockReset();
        vi.mocked(suggestWithGemini).mockReset();
    });

    it('returns local suggestion without calling Gemini when not PRO', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(weakLocal);
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('foo', 'expense', { isPro: false, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...weakLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'unavailable', reason: 'not-pro' },
        });
        expect(suggestWithGemini).not.toHaveBeenCalled();
    });

    it('returns no-match when not PRO and local also finds nothing', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(null);
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('desconocido', 'expense', { isPro: false, online: true });

        expect(result).toEqual({
            status: 'no-match',
            geminiDiagnosis: { status: 'unavailable', reason: 'not-pro' },
        });
        expect(suggestWithGemini).not.toHaveBeenCalled();
    });

    it('returns no-match when PRO is active but no key is stored and local has no match', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(null);
        clearGeminiApiKey();

        const result = await suggestCategoryWithLlm('desconocido', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'no-match',
            geminiDiagnosis: { status: 'unavailable', reason: 'no-api-key' },
        });
        expect(suggestWithGemini).not.toHaveBeenCalled();
    });

    it('returns no-match when offline and local has no match', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(null);
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('desconocido', 'expense', { isPro: true, online: false });

        expect(result).toEqual({
            status: 'no-match',
            geminiDiagnosis: { status: 'unavailable', reason: 'offline' },
        });
        expect(suggestWithGemini).not.toHaveBeenCalled();
    });

    it('prioritizes Gemini over strong local when PRO + key + online', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({
            status: 'success',
            suggestion: {
                ...strongLocal,
                categoryId: 'gemini-cat',
                categoryPath: 'Gemini Category',
                source: 'gemini',
            },
        });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('luz', 'expense', { isPro: true, online: true });

        expect(suggestWithGemini).toHaveBeenCalledOnce();
        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.source).toBe('gemini');
            expect(result.suggestion.categoryId).toBe('gemini-cat');
        }
    });

    it('documents actual behavior: Gemini wins even if local engine has higher confidence (priority order)', async () => {
        // Local engine has 0.95 confidence, Gemini has 0.65 confidence
        vi.mocked(suggestCategory).mockResolvedValue({
            ...strongLocal,
            confidence: 0.95,
        });
        vi.mocked(suggestWithGemini).mockResolvedValue({
            status: 'success',
            suggestion: {
                ...weakLocal,
                confidence: 0.65,
                source: 'gemini',
            },
        });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('gasto test', 'expense', { isPro: true, online: true });

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.source).toBe('gemini');
            expect(result.suggestion.confidence).toBe(0.65);
        }
    });

    it('falls back to local when Gemini returns no-match (model-none)', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(weakLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'no-match', reason: 'model-none' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('algo raro', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...weakLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'no-match', reason: 'model-none' },
        });
    });

    // TEST EXPLÍCITO DE FALLBACK 1 (Obligatorio con caso concreto):
    // Gemini rejected:'unknown-root' + local válido ("Sofia › Ropa") -> resultado esperado: se usa el local
    it('explicit fallback: uses local suggestion ("Sofia › Ropa") when Gemini returns rejected: unknown-root', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(sofiaRopaLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'rejected', reason: 'unknown-root' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('Uniforme de Sofia en Falabella', 'expense', { isPro: true, online: true });

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.source).toBe('local');
            expect(result.suggestion.categoryId).toBe('sofia-ropa');
            expect(result.suggestion.categoryPath).toBe('Sofia › Ropa');
            expect(result.geminiDiagnosis).toEqual({ status: 'rejected', reason: 'unknown-root' });
        }
    });

    // TEST EXPLÍCITO DE FALLBACK 2 (Obligatorio con caso concreto):
    // Gemini error:'timeout' + local válido ("Hogar › Otros") -> resultado esperado: se usa el local
    it('explicit fallback: uses local suggestion ("Hogar › Otros") when Gemini returns error: timeout', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(hogarOtrosLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'error', reason: 'timeout' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('Bombillos y tornillos Homecenter', 'expense', { isPro: true, online: true });

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.source).toBe('local');
            expect(result.suggestion.categoryId).toBe('hogar-otros');
            expect(result.suggestion.categoryPath).toBe('Hogar › Otros');
            expect(result.geminiDiagnosis).toEqual({ status: 'error', reason: 'timeout' });
        }
    });

    it('falls back to local when Gemini returns rejected: invalid-json', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'rejected', reason: 'invalid-json' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'rejected', reason: 'invalid-json' },
        });
    });

    it('falls back to local when Gemini returns rejected: invalid-schema', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'rejected', reason: 'invalid-schema' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'rejected', reason: 'invalid-schema' },
        });
    });

    it('falls back to local when Gemini returns rejected: invalid-category-id', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'rejected', reason: 'invalid-category-id' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'rejected', reason: 'invalid-category-id' },
        });
    });

    it('falls back to local when Gemini returns error: http-401', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'error', reason: 'http-401' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'error', reason: 'http-401' },
        });
    });

    it('falls back to local when Gemini returns error: http-429 and provides geminiDiagnosis', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'error', reason: 'http-429' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'error', reason: 'http-429' },
        });
    });

    it('falls back to local when Gemini returns error: http-5xx', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'error', reason: 'http-5xx' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'error', reason: 'http-5xx' },
        });
    });

    it('falls back to local when Gemini returns error: network-error', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'error', reason: 'network-error' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'error', reason: 'network-error' },
        });
    });

    it('returns no-match with geminiDiagnosis when both Gemini and Local fail to find a match', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(null);
        vi.mocked(suggestWithGemini).mockResolvedValue({ status: 'rejected', reason: 'unknown-root' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('gasto totalmente nuevo', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'no-match',
            geminiDiagnosis: { status: 'rejected', reason: 'unknown-root' },
        });
    });

    it('returns no-match when signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();

        const result = await suggestCategoryWithLlm('gasto test', 'expense', {
            isPro: true,
            online: true,
            signal: controller.signal,
        });

        expect(result).toEqual({ status: 'no-match' });
        expect(suggestWithGemini).not.toHaveBeenCalled();
    });
});
