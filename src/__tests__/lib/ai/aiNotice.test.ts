import { describe, expect, it } from 'vitest';
import { formatAiNotice, getAiNotice, type AiNoticeTexts } from '@/lib/ai/aiNotice';
import { AiProviderError, classifyAiError, toAiProviderError } from '@/lib/ai/gateway/errors';
import type { CategorySuggestion } from '@/lib/ai/categorizer';
import type { LlmResult, ModelAttempt, ResolverResult } from '@/lib/ai/types';

const texts: AiNoticeTexts = {
    invalidKey: '{provider}: key inválida.',
    quota: '{provider}: sin cuota.',
    network: '{provider}: sin red.',
    timeout: '{provider}: lento.',
    server: '{provider}: servidor.',
    noMatch: '{provider}: sin categoría clara.',
    backupModel: '{failed} falló; se usó {used}.',
    usedLocal: 'Reglas locales.',
};

const suggestion: CategorySuggestion = {
    categoryId: 'c1',
    categoryPath: 'Hogar',
    confidence: 0.9,
    reason: 'x',
    needsCategoryCreation: false,
};

const localSuccess = (aiDiagnosis?: LlmResult): ResolverResult => ({ status: 'success', suggestion, source: 'local', aiDiagnosis });
const noMatch = (aiDiagnosis?: LlmResult): ResolverResult => ({ status: 'no-match', aiDiagnosis });

describe('classifyAiError / toAiProviderError', () => {
    const attempt = (httpStatus?: number): ModelAttempt => ({ model: 'm', modelLabel: 'M', status: 'failed', httpStatus });

    it.each([
        ['Gemini API 401 Unauthorized: bad', [attempt(401)], 'http-401'],
        ['Error de autenticación con OpenAI (403): x', [], 'http-401'],
        ['Gemini request failed on all models (429): quota', [attempt(429)], 'http-429'],
        ['Groq request failed on all models (503): busy', [attempt(503)], 'http-5xx'],
        ['Gemini request timeout after 6000ms', [], 'timeout'],
        ['Anthropic request timed out after 8000ms', [], 'timeout'],
        ['Failed to fetch', [], 'network-error'],
    ] as const)('%s -> %s', (message, attempts, expected) => {
        expect(classifyAiError(message, [...attempts])).toBe(expected);
    });

    it('does not mistake durations like "500ms" for an HTTP status', () => {
        expect(classifyAiError('Request took 500ms', [])).toBe('network-error');
    });

    it('wraps errors keeping message and attempts, and passes aborts through', () => {
        const attempts = [attempt(429)];
        const wrapped = toAiProviderError(new Error('boom (429)'), attempts);
        expect(wrapped).toBeInstanceOf(AiProviderError);
        expect(wrapped.message).toBe('boom (429)');
        expect((wrapped as AiProviderError).reason).toBe('http-429');
        expect((wrapped as AiProviderError).attempts).toBe(attempts);

        const abort = new DOMException('Aborted by caller', 'AbortError');
        expect(toAiProviderError(abort, attempts)).toBe(abort);
    });
});

describe('getAiNotice', () => {
    it.each([
        ['http-401', 'invalid-key'],
        ['http-429', 'quota'],
        ['http-5xx', 'server'],
        ['timeout', 'timeout'],
        ['network-error', 'network'],
    ] as const)('maps error %s to %s, also when no local suggestion exists', (reason, kind) => {
        expect(getAiNotice(noMatch({ status: 'error', reason }))).toEqual({ kind, usedLocal: false });
        expect(getAiNotice(localSuccess({ status: 'error', reason }))).toEqual({ kind, usedLocal: true });
    });

    it('maps model-none and rejected answers to no-match', () => {
        expect(getAiNotice(noMatch({ status: 'no-match', reason: 'model-none' }))?.kind).toBe('no-match');
        expect(getAiNotice(localSuccess({ status: 'rejected', reason: 'invalid-category-id' }))?.kind).toBe('no-match');
    });

    it('stays silent when AI is simply unavailable or there is no diagnosis', () => {
        expect(getAiNotice(localSuccess({ status: 'unavailable', reason: 'no-api-key' }))).toBeNull();
        expect(getAiNotice(localSuccess({ status: 'unavailable', reason: 'offline' }))).toBeNull();
        expect(getAiNotice(localSuccess())).toBeNull();
    });

    it('reports a backup model only when the AI answered after other models failed', () => {
        const attempts: ModelAttempt[] = [
            { model: 'a', modelLabel: 'Model A', status: 'failed', httpStatus: 503 },
            { model: 'b', modelLabel: 'Model B', status: 'success' },
        ];
        const aiOk: LlmResult = { status: 'success', suggestion, attempts };
        const result: ResolverResult = { status: 'success', suggestion, source: 'gemini', aiDiagnosis: aiOk };
        expect(getAiNotice(result)).toEqual({ kind: 'backup-model', usedLocal: false, failedModels: 'Model A (503)', usedModel: 'Model B' });

        const clean: ResolverResult = { status: 'success', suggestion, source: 'gemini', aiDiagnosis: { status: 'success', suggestion, attempts: [attempts[1]] } };
        expect(getAiNotice(clean)).toBeNull();
    });
});

describe('formatAiNotice', () => {
    it('inserts the provider and appends the local fallback sentence only when used', () => {
        expect(formatAiNotice({ kind: 'quota', usedLocal: false }, 'Google Gemini', texts)).toBe('Google Gemini: sin cuota.');
        expect(formatAiNotice({ kind: 'invalid-key', usedLocal: true }, 'OpenAI (ChatGPT)', texts)).toBe('OpenAI (ChatGPT): key inválida. Reglas locales.');
    });

    it('formats the backup model notice', () => {
        expect(
            formatAiNotice({ kind: 'backup-model', usedLocal: false, failedModels: 'A (503)', usedModel: 'B' }, 'Gemini', texts)
        ).toBe('A (503) falló; se usó B.');
    });
});
