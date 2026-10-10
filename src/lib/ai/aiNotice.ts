import type { ModelAttempt, ResolverResult } from './types';

export type AiNoticeKind =
    | 'invalid-key'
    | 'quota'
    | 'network'
    | 'timeout'
    | 'server'
    | 'no-match'
    | 'backup-model';

export interface AiNotice {
    kind: AiNoticeKind;
    /** True when the suggestion shown comes from the local engine instead of the AI. */
    usedLocal: boolean;
    /** backup-model only: models that failed before one worked. */
    failedModels?: string;
    /** backup-model only: model that finally answered. */
    usedModel?: string;
}

export interface AiNoticeTexts {
    invalidKey: string;
    quota: string;
    network: string;
    timeout: string;
    server: string;
    noMatch: string;
    backupModel: string;
    usedLocal: string;
}

function describeAttempt(a: ModelAttempt): string {
    return `${a.modelLabel} (${a.httpStatus ?? a.errorReason ?? 'error'})`;
}

/**
 * Turns the AI diagnosis of a resolver result into a user-facing notice kind.
 * Returns null when there is nothing worth telling (AI not configured, offline, or all fine).
 */
export function getAiNotice(result: ResolverResult): AiNotice | null {
    const diagnosis = result.aiDiagnosis ?? result.geminiDiagnosis;
    if (!diagnosis) return null;

    const usedLocal = result.status === 'success' && result.source === 'local';

    switch (diagnosis.status) {
        case 'unavailable':
            return null;
        case 'error':
            switch (diagnosis.reason) {
                case 'http-401':
                    return { kind: 'invalid-key', usedLocal };
                case 'http-429':
                    return { kind: 'quota', usedLocal };
                case 'http-5xx':
                    return { kind: 'server', usedLocal };
                case 'timeout':
                    return { kind: 'timeout', usedLocal };
                default:
                    return { kind: 'network', usedLocal };
            }
        case 'no-match':
        case 'rejected':
            return { kind: 'no-match', usedLocal };
        case 'success': {
            const attempts = diagnosis.attempts ?? [];
            const failed = attempts.filter((a) => a.status === 'failed');
            if (usedLocal || failed.length === 0) return null;
            const used = attempts.find((a) => a.status === 'success');
            return {
                kind: 'backup-model',
                usedLocal,
                failedModels: failed.map(describeAttempt).join(', '),
                usedModel: used?.modelLabel,
            };
        }
    }
}

const KIND_TO_TEXT: Record<Exclude<AiNoticeKind, 'backup-model'>, keyof AiNoticeTexts> = {
    'invalid-key': 'invalidKey',
    quota: 'quota',
    network: 'network',
    timeout: 'timeout',
    server: 'server',
    'no-match': 'noMatch',
};

export function formatAiNotice(notice: AiNotice, providerLabel: string, texts: AiNoticeTexts): string {
    if (notice.kind === 'backup-model') {
        return texts.backupModel
            .replace('{failed}', notice.failedModels ?? '')
            .replace('{used}', notice.usedModel ?? providerLabel);
    }
    const base = texts[KIND_TO_TEXT[notice.kind]].replace('{provider}', providerLabel);
    return notice.usedLocal ? `${base} ${texts.usedLocal}` : base;
}
