import type { AiProviderType } from '../types';
import { getAiApiKey } from './config';
import { AnthropicProviderClient } from './anthropicAdapter';
import { GeminiProviderClient } from './geminiAdapter';
import { GroqProviderClient } from './groqAdapter';
import type { AiProviderClient } from './types';

export function createAiClient(provider: AiProviderType, apiKey?: string | null): AiProviderClient {
    const key = (apiKey ?? getAiApiKey(provider))?.trim();
    if (!key) {
        throw new Error(`No API key configured for provider: ${provider}`);
    }

    switch (provider) {
        case 'gemini':
            return new GeminiProviderClient(key);
        case 'groq':
            return new GroqProviderClient(key);
        case 'anthropic':
            return new AnthropicProviderClient(key);
        default:
            throw new Error(`Unsupported AI provider: ${provider}`);
    }
}
