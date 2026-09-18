import type { CategorySuggestion } from './categorizer';

export type AiProviderType = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama' | 'deepseek' | 'custom';

export interface ModelAttempt {
  provider?: AiProviderType;
  model: string;
  modelLabel: string;
  status: 'trying' | 'success' | 'failed';
  errorReason?: string;
  httpStatus?: number;
}

export type LlmResult =
  | { status: 'success'; suggestion: CategorySuggestion; modelUsed?: string; providerUsed?: AiProviderType; attempts?: ModelAttempt[] }
  | { status: 'no-match'; reason: 'model-none'; modelUsed?: string; providerUsed?: AiProviderType; attempts?: ModelAttempt[] }
  | { status: 'rejected'; reason: 'invalid-json' | 'invalid-schema' | 'invalid-category-id' | 'unknown-root'; modelUsed?: string; providerUsed?: AiProviderType; attempts?: ModelAttempt[] }
  | { status: 'unavailable'; reason: 'not-pro' | 'no-api-key' | 'offline'; attempts?: ModelAttempt[] }
  | { status: 'error'; reason: 'timeout' | 'http-401' | 'http-429' | 'http-5xx' | 'network-error'; attempts?: ModelAttempt[] };

/** Backwards-compatible aliases */
export type GeminiResult = LlmResult;
export type SuggestionResult = LlmResult;

export type ResolverResult =
  | {
      status: 'success';
      suggestion: CategorySuggestion;
      source: 'local' | AiProviderType;
      geminiDiagnosis?: GeminiResult;
      aiDiagnosis?: LlmResult;
    }
  | {
      status: 'no-match';
      geminiDiagnosis?: GeminiResult;
      aiDiagnosis?: LlmResult;
    }
  | {
      status: 'unavailable';
      reason: string;
      geminiDiagnosis?: GeminiResult;
      aiDiagnosis?: LlmResult;
    }
  | {
      status: 'error';
      reason: string;
      geminiDiagnosis?: GeminiResult;
      aiDiagnosis?: LlmResult;
    };


