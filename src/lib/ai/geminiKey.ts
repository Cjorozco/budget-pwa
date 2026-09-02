import { GEMINI_KEY_STORAGE_KEY } from './geminiConfig';

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

export function getGeminiApiKey(): string | null {
    const value = readStore(GEMINI_KEY_STORAGE_KEY);
    return value && value.trim().length > 0 ? value.trim() : null;
}

export function hasGeminiApiKey(): boolean {
    return getGeminiApiKey() !== null;
}

export function setGeminiApiKey(key: string): void {
    const trimmed = key.trim();
    if (!trimmed) {
        clearGeminiApiKey();
        return;
    }
    writeStore(GEMINI_KEY_STORAGE_KEY, trimmed);
}

export function clearGeminiApiKey(): void {
    removeStore(GEMINI_KEY_STORAGE_KEY);
}

export function maskGeminiApiKey(key: string): string {
    const trimmed = key.trim();
    if (trimmed.length <= 8) return '••••';
    return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/** Google AI Studio keys vary in prefix (AIza…, AQ…). Reject obvious OpenAI/Anthropic keys. */
const MIN_GEMINI_KEY_LENGTH = 16;

export function looksLikeGeminiApiKey(value: string): boolean {
    const trimmed = value.trim();
    if (trimmed.startsWith('sk-')) return false;
    return trimmed.length >= MIN_GEMINI_KEY_LENGTH;
}

export function rejectedKeyReason(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return 'Pega una API key de Google AI Studio.';
    if (trimmed.startsWith('sk-ant')) {
        return 'Eso parece una key de Anthropic (Claude). Por ahora solo se llama a Google Gemini desde el navegador.';
    }
    if (trimmed.startsWith('sk-')) {
        return 'Eso parece una key de OpenAI. Por ahora solo se llama a Google Gemini (AI Studio).';
    }
    if (trimmed.length < MIN_GEMINI_KEY_LENGTH) {
        return 'La key parece incompleta. Pégala completa desde Google AI Studio.';
    }
    return null;
}
