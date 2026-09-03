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

    it('returns local without calling Gemini when not PRO', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(weakLocal);
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('foo', 'expense', { isPro: false, online: true });

        expect(result?.source).toBe('local');
        expect(suggestWithGemini).not.toHaveBeenCalled();
    });

    it('prioritizes Gemini over strong local when PRO + key + online', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(strongLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({
            ...strongLocal,
            categoryId: 'gemini-cat',
            categoryPath: 'Gemini Category',
            source: 'gemini',
        });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('luz', 'expense', { isPro: true, online: true });

        expect(suggestWithGemini).toHaveBeenCalledOnce();
        expect(result?.source).toBe('gemini');
        expect(result?.categoryId).toBe('gemini-cat');
    });

    it('uses Gemini when PRO + key + online + weak local', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(weakLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue({
            ...strongLocal,
            source: 'gemini',
            reason: 'Gemini',
        });
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('algo raro', 'expense', { isPro: true, online: true });

        expect(suggestWithGemini).toHaveBeenCalledOnce();
        expect(result?.source).toBe('gemini');
    });

    it('falls back to local when Gemini returns null', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(weakLocal);
        vi.mocked(suggestWithGemini).mockResolvedValue(null);
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        const result = await suggestCategoryWithLlm('algo raro', 'expense', { isPro: true, online: true });

        expect(result?.source).toBe('local');
        expect(result?.categoryId).toBe('fin');
    });

    it('does not call Gemini offline', async () => {
        vi.mocked(suggestCategory).mockResolvedValue(weakLocal);
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');

        await suggestCategoryWithLlm('foo', 'expense', { isPro: true, online: false });

        expect(suggestWithGemini).not.toHaveBeenCalled();
    });
});
