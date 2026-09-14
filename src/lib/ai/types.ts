import type { CategorySuggestion } from './categorizer';

export type GeminiResult =
  | { status: 'success'; suggestion: CategorySuggestion }
  | { status: 'no-match'; reason: 'model-none' }
  | { status: 'rejected'; reason: 'invalid-json' | 'invalid-schema' | 'invalid-category-id' | 'unknown-root' }
  | { status: 'unavailable'; reason: 'not-pro' | 'no-api-key' | 'offline' }
  | { status: 'error'; reason: 'timeout' | 'http-401' | 'http-429' | 'http-5xx' | 'network-error' };

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
