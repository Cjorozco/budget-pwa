import type { AiProviderType, ModelAttempt } from '../types';
import { getAiApiKey, getSelectedAiProvider } from './config';
import { createAiClient } from './factory';
import type { AiGenerateResult } from './types';

export const UNIFIED_SYSTEM_PROMPT = `Eres un asistente experto de categorización para un presupuesto personal en Colombia.
Responde ÚNICAMENTE un objeto JSON válido con este esquema exacto:
{"match":"existing"|"create"|"none","categoryId":string|null,"parentName":string|null,"subcategoryName":string|null,"confidence":number,"reason":string}

Reglas fundamentales:
- PRIORIDAD TOTAL A CATEGORÍAS EXISTENTES: Clasifica el gasto basándote estrictamente en las categorías que existen en el catálogo del usuario y en sus transacciones previas.
- Si la descripción encaja semánticamente en una categoría existente del catálogo, DEBES responder match="existing" con el categoryId exacto del catálogo.
- match="create": SOLO si ninguna categoría existente del catálogo encaja para este gasto. En tal caso, parentName DEBE ser el nombre exacto de una categoría raíz que YA exista en el catálogo del usuario; subcategoryName es la subcategoría nueva a crear.
- match="none": si la descripción no tiene relación o no hay contexto suficiente.
- reason: una frase corta y descriptiva en español.
- No inventes IDs. No agregues texto explicativo ni markdown fuera del JSON.`;

export interface OrchestrateAiOptions {
    provider?: AiProviderType;
    apiKey?: string;
    systemPrompt?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    temperature?: number;
    onProgress?: (attempt: ModelAttempt, friendlyMessage: string) => void;
}

/**
 * AI Gateway Orchestrator:
 * Injects unified system prompt, calls the active provider, enforces 8s timeout via AbortController,
 * and returns raw text ready for upper-layer Zod validation.
 */
export async function executeAiPrompt(
    businessPrompt: string,
    options: OrchestrateAiOptions = {}
): Promise<AiGenerateResult> {
    const provider = options.provider ?? getSelectedAiProvider();
    const apiKey = options.apiKey ?? getAiApiKey(provider);

    if (!apiKey) {
        throw new Error(`No API key configured for AI provider: ${provider}`);
    }

    const client = createAiClient(provider, apiKey);
    const timeoutMs = options.timeoutMs ?? 8000;

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    const onParentAbort = () => timeoutController.abort();
    options.signal?.addEventListener('abort', onParentAbort);

    try {
        const result = await client.generate({
            prompt: businessPrompt,
            systemPrompt: options.systemPrompt ?? UNIFIED_SYSTEM_PROMPT,
            signal: timeoutController.signal,
            timeoutMs,
            temperature: options.temperature ?? 0.2,
            onProgress: options.onProgress,
        });

        return result;
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onParentAbort);
    }
}
