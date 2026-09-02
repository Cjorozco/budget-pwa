import { afterEach, describe, expect, it } from 'vitest';
import { exportDatabase } from '@/lib/db/backup';
import { db } from '@/lib/db';
import { GEMINI_KEY_STORAGE_KEY } from '@/lib/ai/geminiConfig';
import { clearGeminiApiKey, setGeminiApiKey } from '@/lib/ai/geminiKey';

describe('backup excludes Gemini API key', () => {
    afterEach(() => {
        clearGeminiApiKey();
    });

    it('does not write the localStorage key into the JSON backup', async () => {
        setGeminiApiKey('AIzaSyDummyKeyForUnitTests1234567890');
        await db.appConfig.clear();
        await db.appConfig.add({
            id: 'singleton',
            defaultCurrency: 'COP',
            minConfidenceThreshold: 0.7,
            enableAISuggestions: true,
        });

        const json = await exportDatabase();

        expect(json).not.toContain('AIzaSyDummyKeyForUnitTests1234567890');
        expect(json).not.toContain(GEMINI_KEY_STORAGE_KEY);
    });
});
