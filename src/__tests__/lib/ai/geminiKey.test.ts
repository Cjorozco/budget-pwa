import { afterEach, describe, expect, it } from 'vitest';
import {
    clearGeminiApiKey,
    getGeminiApiKey,
    looksLikeGeminiApiKey,
    maskGeminiApiKey,
    rejectedKeyReason,
    setGeminiApiKey,
} from '@/lib/ai/geminiKey';

describe('geminiKey', () => {
    afterEach(() => {
        clearGeminiApiKey();
    });

    it('stores and reads a key from localStorage, not as empty string', () => {
        expect(getGeminiApiKey()).toBeNull();
        setGeminiApiKey('  AIzaSyDummyKeyForUnitTests1234567890  ');
        expect(getGeminiApiKey()).toBe('AIzaSyDummyKeyForUnitTests1234567890');
    });

    it('masks the stored key', () => {
        expect(maskGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890')).toBe('AIza…7890');
    });

    it('rejects OpenAI and Anthropic prefixes', () => {
        expect(rejectedKeyReason('sk-proj-abc')).toMatch(/OpenAI/);
        expect(rejectedKeyReason('sk-ant-abc')).toMatch(/Anthropic/);
        expect(looksLikeGeminiApiKey('sk-proj-abc')).toBe(false);
        expect(looksLikeGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890')).toBe(true);
    });
});
