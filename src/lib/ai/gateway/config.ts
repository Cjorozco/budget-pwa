import { GEMINI_KEY_STORAGE_KEY } from '../geminiConfig';
import type { AiProviderType } from '../types';

export const AI_SELECTED_PROVIDER_STORAGE_KEY = 'budget_ai_provider';
export const GROQ_KEY_STORAGE_KEY = 'budget_groq_api_key';
export const ANTHROPIC_KEY_STORAGE_KEY = 'budget_anthropic_api_key';
export const OPENAI_KEY_STORAGE_KEY = 'budget_openai_api_key';

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
        case 'anthropic':
            return ANTHROPIC_KEY_STORAGE_KEY;
        case 'openai':
            return OPENAI_KEY_STORAGE_KEY;
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
    /** 'free-tier' when the provider offers a free API tier; 'paid' when prepaid credits are required. */
    pricing: 'free-tier' | 'paid';
    /** Official getting-started documentation. */
    docsUrl: string;
    /** The provider we suggest first to new users (free, no card). */
    recommended?: boolean;
}

export const SUPPORTED_AI_PROVIDERS: ProviderMeta[] = [
    {
        id: 'gemini',
        label: 'Google Gemini',
        keyUrl: 'https://aistudio.google.com/apikey',
        keyUrlLabel: 'Crear API key en Google AI Studio',
        modelDescription: 'Modelo: Gemini 3.5 Flash Lite (con respaldo en Flash Lite 3.1 → Flash 3.6 → 3.8)',
        helpText: 'API key gratuita o de pago creada en Google AI Studio. No sirven ChatGPT Plus ni Claude.ai.',
        placeholder: 'Pega tu key de Google AI Studio (AIzaSy...)',
        pricing: 'free-tier',
        docsUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
        recommended: true,
    },
    {
        id: 'openai',
        label: 'OpenAI (ChatGPT)',
        keyUrl: 'https://platform.openai.com/api-keys',
        keyUrlLabel: 'Crear API key en OpenAI Platform',
        modelDescription: 'Modelo: GPT-4o Mini (con respaldo en GPT-4o)',
        helpText: 'API key de OpenAI Platform (sk-proj-... o sk-...). Respuestas precisas e inferencia económica.',
        placeholder: 'Pega tu key de OpenAI (sk-...)',
        pricing: 'paid',
        docsUrl: 'https://platform.openai.com/docs/quickstart',
    },
    {
        id: 'anthropic',
        label: 'Anthropic Claude',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        keyUrlLabel: 'Crear API key en Anthropic Console',
        modelDescription: 'Modelo: Claude Haiku 5.5 (con respaldo en Claude Haiku 4.5 y Sonnet 5.5)',
        helpText: 'API key de Anthropic Console (sk-ant-api03-...). Inteligencia analítica y asesoría financiera precisa.',
        placeholder: 'Pega tu key de Anthropic (sk-ant-...)',
        pricing: 'paid',
        docsUrl: 'https://docs.anthropic.com/en/docs/get-started',
    },
    {
        id: 'groq',
        label: 'Groq Cloud',
        keyUrl: 'https://console.groq.com/keys',
        keyUrlLabel: 'Crear API key en Groq Console',
        modelDescription: 'Modelo: openai/gpt-oss-120b (con respaldo en gpt-oss-20b, groq/compound y qwen3.8-27b)',
        helpText: 'API key gratuita de Groq Cloud (gsk_...). Categorización ultrarrápida en milisegundos.',
        placeholder: 'Pega tu key de Groq (gsk_...)',
        pricing: 'free-tier',
        docsUrl: 'https://console.groq.com/docs/quickstart',
    },
];

export function getProviderMeta(provider: AiProviderType): ProviderMeta {
    return SUPPORTED_AI_PROVIDERS.find((p) => p.id === provider) ?? SUPPORTED_AI_PROVIDERS[0];
}

export interface ProviderValidationMessages {
    invalidKey?: string;
    looksLikeAnthropic?: string;
    looksLikeOpenAI?: string;
    looksLikeGemini?: string;
    looksLikeGroq?: string;
    geminiIncomplete?: string;
    openAIIncomplete?: string;
    openAIMustStartWithSk?: string;
    anthropicIncomplete?: string;
    anthropicMustStartWithSkAnt?: string;
    groqIncomplete?: string;
}

export function validateProviderKey(provider: AiProviderType, value: string, validations?: ProviderValidationMessages): string | null {
    const trimmed = value.trim();
    if (!trimmed) return validations?.invalidKey ?? 'Pega una API key válida.';
    if (provider === 'gemini') {
        if (trimmed.startsWith('sk-ant')) return validations?.looksLikeAnthropic ?? 'Eso parece una key de Anthropic (Claude). Gemini usa keys de Google AI Studio.';
        if (trimmed.startsWith('sk-')) return validations?.looksLikeOpenAI ?? 'Eso parece una key de OpenAI. Gemini usa keys de Google AI Studio.';
        if (trimmed.length < 16) return validations?.geminiIncomplete ?? 'La key parece incompleta. Pégala completa desde Google AI Studio.';
    } else if (provider === 'openai') {
        if (trimmed.startsWith('AIzaSy')) return validations?.looksLikeGemini ?? 'Eso parece una key de Google Gemini. OpenAI usa keys de platform.openai.com (sk-...).';
        if (trimmed.startsWith('sk-ant')) return validations?.looksLikeAnthropic ?? 'Eso parece una key de Anthropic. OpenAI usa keys de platform.openai.com (sk-...).';
        if (trimmed.startsWith('gsk_')) return validations?.looksLikeGroq ?? 'Eso parece una key de Groq. OpenAI usa keys de platform.openai.com (sk-...).';
        if (!trimmed.startsWith('sk-')) return validations?.openAIMustStartWithSk ?? 'La key de OpenAI debe empezar por sk-... (de platform.openai.com).';
        if (trimmed.length < 20) return validations?.openAIIncomplete ?? 'La key parece incompleta. Pégala completa desde OpenAI Platform.';
    } else if (provider === 'anthropic') {
        if (trimmed.startsWith('AIzaSy')) return validations?.looksLikeGemini ?? 'Eso parece una key de Google Gemini. Anthropic usa keys de console.anthropic.com (sk-ant-...).';
        if (trimmed.startsWith('gsk_')) return validations?.looksLikeGroq ?? 'Eso parece una key de Groq. Anthropic usa keys de console.anthropic.com (sk-ant-...).';
        if (!trimmed.startsWith('sk-ant')) return validations?.anthropicMustStartWithSkAnt ?? 'La key de Anthropic debe empezar por sk-ant-... (de console.anthropic.com).';
        if (trimmed.length < 20) return validations?.anthropicIncomplete ?? 'La key parece incompleta. Pégala completa desde Anthropic Console.';
    } else if (provider === 'groq') {
        if (trimmed.startsWith('sk-ant')) return validations?.looksLikeAnthropic ?? 'Eso parece una key de Anthropic. Groq usa keys de console.groq.com (gsk_...).';
        if (trimmed.length < 10) return validations?.groqIncomplete ?? 'La key parece incompleta. Pégala completa desde Groq Console.';
    }
    return null;
}

