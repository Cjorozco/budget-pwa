import { describe, expect, it } from 'vitest';
import { AI_MODEL_CHAINS, getModelLabel, getModelSpec } from '@/lib/ai/models';
import { GROQ_MODELS } from '@/lib/ai/gateway/groqAdapter';
import { OPENAI_MODELS } from '@/lib/ai/gateway/openaiAdapter';

describe('AI model chains (single source of truth)', () => {
    for (const [provider, chain] of Object.entries(AI_MODEL_CHAINS)) {
        it(`${provider}: has unique ids and a label for every model`, () => {
            const ids = chain.map((m) => m.id);
            expect(new Set(ids).size).toBe(ids.length);
            expect(chain.length).toBeGreaterThan(0);
            for (const m of chain) expect(m.label.length).toBeGreaterThan(0);
        });
    }

    it('resolves labels and falls back to the raw id for unknown models', () => {
        expect(getModelLabel('gemini', 'gemini-3.6-flash')).toBe('Gemini 3.6 Flash');
        expect(getModelLabel('gemini', 'gemini-unknown')).toBe('gemini-unknown');
        expect(getModelSpec('ollama', 'x')).toBeUndefined();
    });

    it('does not include retired or non-generative models', () => {
        expect(OPENAI_MODELS).not.toContain('gpt-3.5-turbo');
        for (const id of GROQ_MODELS) {
            expect(id).not.toMatch(/prompt-guard|safeguard/);
        }
    });

    it('only gives thinkingLevel to Gemini models and never "minimal" to gemini-3.8-flash', () => {
        for (const [provider, chain] of Object.entries(AI_MODEL_CHAINS)) {
            for (const m of chain) {
                if (provider !== 'gemini') expect(m.thinkingLevel).toBeUndefined();
            }
        }
        expect(getModelSpec('gemini', 'gemini-3.8-flash')?.thinkingLevel).not.toBe('minimal');
    });
});
