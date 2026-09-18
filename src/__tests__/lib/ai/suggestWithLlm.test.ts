import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldCallGemini, suggestCategoryWithLlm } from '@/lib/ai/suggestWithLlm';
import type { CategorySuggestion } from '@/lib/ai/categorizer';
import { setGeminiApiKey, clearGeminiApiKey } from '@/lib/ai/geminiKey';
import { setSelectedAiProvider, setAiApiKey, clearAiApiKey } from '@/lib/ai/gateway/config';

vi.mock('@/lib/ai/categorizer', async () => {
    const actual = await vi.importActual<typeof import('@/lib/ai/categorizer')>('@/lib/ai/categorizer');
    return {
        ...actual,
        suggestCategory: vi.fn(),
    };
});

vi.mock('@/lib/ai/geminiSuggest', () => ({
    suggestWithGemini: vi.fn(),
    suggestWithAiProvider: vi.fn(),
    sanitizePii: (t: string) => t,
}));

import { suggestCategory } from '@/lib/ai/categorizer';
import { suggestWithGemini, suggestWithAiProvider } from '@/lib/ai/geminiSuggest';

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
        clearAiApiKey('groq');
        setSelectedAiProvider('gemini');
        vi.mocked(suggestCategory).mockReset();
        vi.mocked(suggestWithGemini).mockReset();
        vi.mocked(suggestWithAiProvider).mockReset();
    });

    it('returns local suggestion without calling AI when not PRO', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(weakLocal);
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('foo', 'expense', { isPro: false, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...weakLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'unavailable', reason: 'not-pro' },
            aiDiagnosis: { status: 'unavailable', reason: 'not-pro' },
        });
        expect(suggestWithAiProvider).not.toHaveBeenCalled();
    });

    it('returns no-match when not PRO and local also finds nothing', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(null);
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('desconocido', 'expense', { isPro: false, online: true });

        expect(result).toEqual({
            status: 'no-match',
            geminiDiagnosis: { status: 'unavailable', reason: 'not-pro' },
            aiDiagnosis: { status: 'unavailable', reason: 'not-pro' },
        });
        expect(suggestWithAiProvider).not.toHaveBeenCalled();
    });

    it('returns no-match when PRO is active but no key is stored and local has no match', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(null);
        clearGeminiApiKey();

        const result = await suggestCategoryWithLlm('desconocido', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'no-match',
            geminiDiagnosis: { status: 'unavailable', reason: 'no-api-key' },
            aiDiagnosis: { status: 'unavailable', reason: 'no-api-key' },
        });
        expect(suggestWithAiProvider).not.toHaveBeenCalled();
    });

    it('returns no-match when offline and local has no match', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(null);
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('desconocido', 'expense', { isPro: true, online: false });

        expect(result).toEqual({
            status: 'no-match',
            geminiDiagnosis: { status: 'unavailable', reason: 'offline' },
            aiDiagnosis: { status: 'unavailable', reason: 'offline' },
        });
        expect(suggestWithAiProvider).not.toHaveBeenCalled();
    });

    it('prioritizes Gemini over strong local when PRO + key + online', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({
            status: 'success',
            providerUsed: 'gemini',
            suggestion: {
                ...strongLocal,
                categoryId: 'gemini-cat',
                categoryPath: 'Gemini Category',
                source: 'gemini',
            },
        });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('luz', 'expense', { isPro: true, online: true });

        expect(suggestWithAiProvider).toHaveBeenCalledOnce();
        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.source).toBe('gemini');
            expect(result.suggestion.categoryId).toBe('gemini-cat');
        }
    });

    it('uses selected Groq provider when Groq is configured in settings', async () => {
        setSelectedAiProvider('groq');
        setAiApiKey('groq', 'gsk_dummyGroqKey123456789');
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({
            status: 'success',
            providerUsed: 'groq',
            suggestion: {
                ...strongLocal,
                categoryId: 'groq-cat',
                categoryPath: 'Groq Category',
                source: 'groq',
            },
        });

        const result = await suggestCategoryWithLlm('restaurante', 'expense', { isPro: true, online: true });

        expect(suggestWithAiProvider).toHaveBeenCalledOnce();
        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.source).toBe('groq');
            expect(result.suggestion.categoryId).toBe('groq-cat');
        }
    });

    it('documents actual behavior: AI wins even if local engine has higher confidence (priority order)', async () => {
        vi.mocked(suggestCategory).mockResolvedValue({
            ...strongLocal,
            confidence: 0.95,
        });
        vi.mocked(suggestWithAiProvider).mockResolvedValue({
            status: 'success',
            providerUsed: 'gemini',
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

    it('falls back to local when AI returns no-match (model-none)', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(weakLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'no-match', reason: 'model-none' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('algo raro', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...weakLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'no-match', reason: 'model-none' },
            aiDiagnosis: { status: 'no-match', reason: 'model-none' },
        });
    });

    it('explicit fallback: uses local suggestion ("Sofia › Ropa") when AI returns rejected: unknown-root', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(sofiaRopaLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'rejected', reason: 'unknown-root' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('Uniforme de Sofia en Falabella', 'expense', { isPro: true, online: true });

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.source).toBe('local');
            expect(result.suggestion.categoryId).toBe('sofia-ropa');
            expect(result.suggestion.categoryPath).toBe('Sofia › Ropa');
            expect(result.aiDiagnosis).toEqual({ status: 'rejected', reason: 'unknown-root' });
        }
    });

    it('explicit fallback: uses local suggestion ("Hogar › Otros") when AI returns error: timeout', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(hogarOtrosLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'error', reason: 'timeout' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('Bombillos y tornillos Homecenter', 'expense', { isPro: true, online: true });

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.source).toBe('local');
            expect(result.suggestion.categoryId).toBe('hogar-otros');
            expect(result.suggestion.categoryPath).toBe('Hogar › Otros');
            expect(result.aiDiagnosis).toEqual({ status: 'error', reason: 'timeout' });
        }
    });

    it('falls back to local when AI returns rejected: invalid-json', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'rejected', reason: 'invalid-json' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'rejected', reason: 'invalid-json' },
            aiDiagnosis: { status: 'rejected', reason: 'invalid-json' },
        });
    });

    it('falls back to local when AI returns rejected: invalid-schema', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'rejected', reason: 'invalid-schema' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'rejected', reason: 'invalid-schema' },
            aiDiagnosis: { status: 'rejected', reason: 'invalid-schema' },
        });
    });

    it('falls back to local when AI returns rejected: invalid-category-id', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'rejected', reason: 'invalid-category-id' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'rejected', reason: 'invalid-category-id' },
            aiDiagnosis: { status: 'rejected', reason: 'invalid-category-id' },
        });
    });

    it('falls back to local when AI returns error: http-401', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'error', reason: 'http-401' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'error', reason: 'http-401' },
            aiDiagnosis: { status: 'error', reason: 'http-401' },
        });
    });

    it('falls back to local when AI returns error: http-429 and provides geminiDiagnosis/aiDiagnosis', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'error', reason: 'http-429' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'error', reason: 'http-429' },
            aiDiagnosis: { status: 'error', reason: 'http-429' },
        });
    });

    it('falls back to local when AI returns error: http-5xx', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'error', reason: 'http-5xx' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'error', reason: 'http-5xx' },
            aiDiagnosis: { status: 'error', reason: 'http-5xx' },
        });
    });

    it('falls back to local when AI returns error: network-error', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'error', reason: 'network-error' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('recibo de energia', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'success',
            suggestion: { ...strongLocal, source: 'local' },
            source: 'local',
            geminiDiagnosis: { status: 'error', reason: 'network-error' },
            aiDiagnosis: { status: 'error', reason: 'network-error' },
        });
    });

    it('returns no-match with diagnosis when both AI and Local fail to find a match', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(null);
        vi.mocked(suggestWithAiProvider).mockResolvedValue({ status: 'rejected', reason: 'unknown-root' });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('gasto totalmente nuevo', 'expense', { isPro: true, online: true });

        expect(result).toEqual({
            status: 'no-match',
            geminiDiagnosis: { status: 'rejected', reason: 'unknown-root' },
            aiDiagnosis: { status: 'rejected', reason: 'unknown-root' },
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
        expect(suggestWithAiProvider).not.toHaveBeenCalled();
    });
});
