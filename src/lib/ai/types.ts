import type { CategorySuggestion } from './categorizer';

export interface ModelAttempt {
  model: string;
  modelLabel: string;
  status: 'trying' | 'success' | 'failed';
  errorReason?: string;
  httpStatus?: number;
}

export type GeminiResult =
  | { status: 'success'; suggestion: CategorySuggestion; modelUsed?: string; attempts?: ModelAttempt[] }
  | { status: 'no-match'; reason: 'model-none'; modelUsed?: string; attempts?: ModelAttempt[] }
  | { status: 'rejected'; reason: 'invalid-json' | 'invalid-schema' | 'invalid-category-id' | 'unknown-root'; modelUsed?: string; attempts?: ModelAttempt[] }
  | { status: 'unavailable'; reason: 'not-pro' | 'no-api-key' | 'offline'; attempts?: ModelAttempt[] }
  | { status: 'error'; reason: 'timeout' | 'http-401' | 'http-429' | 'http-5xx' | 'network-error'; attempts?: ModelAttempt[] };

export type ResolverResult =
  | {
      status: 'success';
      suggestion: CategorySuggestion;
      source: 'gemini' | 'local';
      geminiDiagnosis?: GeminiResult;
    }
  | {
      status: 'no-match';
      geminiDiagnosis?: GeminiResult;
    }
  | {
      status: 'unavailable';
      reason: string;
      geminiDiagnosis?: GeminiResult;
    }
  | {
      status: 'error';
      reason: string;
      geminiDiagnosis?: GeminiResult;
    };

