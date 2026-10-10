import type { ModelAttempt } from '../types';

export type AiErrorReason = 'timeout' | 'http-401' | 'http-429' | 'http-5xx' | 'network-error';

/** Error thrown by provider adapters, carrying a typed reason and the attempts made. */
export class AiProviderError extends Error {
    readonly reason: AiErrorReason;
    readonly attempts: ModelAttempt[];

    constructor(message: string, reason: AiErrorReason, attempts: ModelAttempt[]) {
        super(message);
        this.name = 'AiProviderError';
        this.reason = reason;
        this.attempts = attempts;
    }
}

/** Decides the reason from the last HTTP status seen, falling back to the error message. */
export function classifyAiError(message: string, attempts: ModelAttempt[]): AiErrorReason {
    if (/timeout|timed out/i.test(message)) return 'timeout';

    const lastWithStatus = [...attempts].reverse().find((a) => a.httpStatus !== undefined);
    const fromMessage = message.match(/\b([45]\d\d)\b/);
    const status = lastWithStatus?.httpStatus ?? (fromMessage ? Number(fromMessage[1]) : undefined);

    if (status === 401 || status === 403) return 'http-401';
    if (status === 429) return 'http-429';
    if (status !== undefined && status >= 500 && status <= 599) return 'http-5xx';
    return 'network-error';
}

/** Wraps any adapter failure as an AiProviderError; caller aborts are passed through untouched. */
export function toAiProviderError(err: unknown, attempts: ModelAttempt[]): Error {
    if (err instanceof AiProviderError) return err;
    // DOMException is not always an Error subclass, so check by name.
    if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError') {
        return err as Error;
    }
    const message = err instanceof Error ? err.message : String(err);
    return new AiProviderError(message, classifyAiError(message, attempts), attempts);
}
