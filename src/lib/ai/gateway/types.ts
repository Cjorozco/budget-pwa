import type { AiProviderType, ModelAttempt } from '../types';

export interface AiGenerateOptions {
    prompt: string;
    systemPrompt?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    temperature?: number;
    onProgress?: (attempt: ModelAttempt, friendlyMessage: string) => void;
}

export interface AiGenerateResult {
    text: string;
    modelUsed: string;
    provider: AiProviderType;
    attempts?: ModelAttempt[];
}

export interface ConnectionTestResult {
    ok: boolean;
    message: string;
    modelUsed?: string;
    attempts?: ModelAttempt[];
}

/**
 * Standard abstraction for client-side AI providers (Gemini, Groq, OpenAI, etc.)
 */
export interface AiProviderClient {
    readonly provider: AiProviderType;
    generate(options: AiGenerateOptions): Promise<AiGenerateResult>;
    testConnection(): Promise<ConnectionTestResult>;
}
