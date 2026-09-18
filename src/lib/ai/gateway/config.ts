import { GEMINI_KEY_STORAGE_KEY } from '../geminiConfig';
import type { AiProviderType } from '../types';

export const AI_SELECTED_PROVIDER_STORAGE_KEY = 'budget_ai_provider';
export const GROQ_KEY_STORAGE_KEY = 'budget_groq_api_key';

const memoryStore = new Map<string, string>();

function readStore(key: string): string | null {
    try {
        const value = localStorage.getItem(key);
        if (value !== null) return value;
    } catch {
        // jsdom/Node workers and private mode
    }
    return memoryStore.get(key) ?? null;
}

function writeStore(key: string, value: string): void {
    memoryStore.set(key, value);
    try {
        localStorage.setItem(key, value);
    } catch {
        // persist in memory for this session
    }
}

function removeStore(key: string): void {
    memoryStore.delete(key);
    try {
        localStorage.removeItem(key);
    } catch {
        // persist in memory for this session
    }
}

export function getProviderStorageKey(provider: AiProviderType): string {
    switch (provider) {
        case 'gemini':
            return GEMINI_KEY_STORAGE_KEY;
        case 'groq':
            return GROQ_KEY_STORAGE_KEY;
        default:
            return `budget_${provider}_api_key`;
    }
}

export function getSelectedAiProvider(): AiProviderType {
    const stored = readStore(AI_SELECTED_PROVIDER_STORAGE_KEY);
    if (stored === 'groq' || stored === 'gemini' || stored === 'openai' || stored === 'anthropic') {
        return stored;
    }
    return 'gemini';
}

export function setSelectedAiProvider(provider: AiProviderType): void {
    writeStore(AI_SELECTED_PROVIDER_STORAGE_KEY, provider);
}

export function getAiApiKey(provider: AiProviderType): string | null {
    const key = getProviderStorageKey(provider);
    const value = readStore(key);
    return value && value.trim().length > 0 ? value.trim() : null;
}

export function setAiApiKey(provider: AiProviderType, apiKey: string): void {
    const key = getProviderStorageKey(provider);
    const trimmed = apiKey.trim();
    if (!trimmed) {
        clearAiApiKey(provider);
        return;
    }
    writeStore(key, trimmed);
}

export function clearAiApiKey(provider: AiProviderType): void {
    const key = getProviderStorageKey(provider);
    removeStore(key);
}

export function hasAiApiKey(provider: AiProviderType): boolean {
    return getAiApiKey(provider) !== null;
}

export function maskApiKey(apiKey: string): string {
    const trimmed = apiKey.trim();
    if (trimmed.length <= 8) return '••••';
    return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export interface ProviderMeta {
    id: AiProviderType;
    label: string;
    keyUrl: string;
    keyUrlLabel: string;
    modelDescription: string;
    helpText: string;
    placeholder: string;
}

export const SUPPORTED_AI_PROVIDERS: ProviderMeta[] = [
    {
        id: 'gemini',
        label: 'Google Gemini',
        keyUrl: 'https://aistudio.google.com/apikey',
        keyUrlLabel: 'Crear API key en Google AI Studio',
        modelDescription: 'Modelo: Gemini 3.1 Flash Lite (con respaldo en Flash 3.5 → 3.6 → 3.7 → 3.8)',
        helpText: 'API key gratuita o de pago creada en Google AI Studio. No sirven ChatGPT Plus ni Claude.ai.',
        placeholder: 'Pega tu key de Google AI Studio (AIzaSy...)',
    },
    {
        id: 'groq',
        label: 'Groq Cloud',
        keyUrl: 'https://console.groq.com/keys',
        keyUrlLabel: 'Crear API key en Groq Console',
        modelDescription: 'Modelo: openai/gpt-oss-120b (con respaldo en gpt-oss-20b, groq/compound y qwen3.8-27b)',
        helpText: 'API key gratuita de Groq Cloud (gsk_...). Categorización ultrarrápida en milisegundos.',
        placeholder: 'Pega tu key de Groq (gsk_...)',
    },
];

export function getProviderMeta(provider: AiProviderType): ProviderMeta {
    return SUPPORTED_AI_PROVIDERS.find((p) => p.id === provider) ?? SUPPORTED_AI_PROVIDERS[0];
}

export function validateProviderKey(provider: AiProviderType, value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return 'Pega una API key válida.';
    if (provider === 'gemini') {
        if (trimmed.startsWith('sk-ant')) return 'Eso parece una key de Anthropic (Claude). Gemini usa keys de Google AI Studio.';
        if (trimmed.startsWith('sk-')) return 'Eso parece una key de OpenAI. Gemini usa keys de Google AI Studio.';
        if (trimmed.length < 16) return 'La key parece incompleta. Pégala completa desde Google AI Studio.';
    } else if (provider === 'groq') {
        if (trimmed.startsWith('sk-ant')) return 'Eso parece una key de Anthropic. Groq usa keys de console.groq.com (gsk_...).';
        if (trimmed.length < 10) return 'La key parece incompleta. Pégala completa desde Groq Console.';
    }
    return null;
}

