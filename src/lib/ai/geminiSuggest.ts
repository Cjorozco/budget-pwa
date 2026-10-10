import { db } from '../db';
import {
    findCategoryByPath,
    formatCategoryPath,
    resolveCategoryPathLabel,
} from './categoryResolver';
import {
    categoryNamesAreSimilar,
    normalizeForMatch,
} from './categoryRules';
import { getAiApiKey, getSelectedAiProvider } from './gateway/config';
import { createAiClient } from './gateway/factory';
import type { GeminiResult, LlmResult, ModelAttempt } from './types';

export type { GeminiResult, LlmResult, ModelAttempt };
export type SuggestionResult = GeminiResult;

import {
    GenericLlmSuggestionSchema,
    LlmSuggestionSchema,
    type GenericLlmSuggestionPayload,
    type LlmSuggestionPayload,
    extractJsonObject,
} from './contracts';

export {
    GenericLlmSuggestionSchema,
    LlmSuggestionSchema,
    type GenericLlmSuggestionPayload,
    type LlmSuggestionPayload,
    extractJsonObject,
};

interface CatalogRow {
    id: string;
    path: string;
    isLeaf: boolean;
}

export async function loadCategoryCatalog(
    type: 'income' | 'expense'
): Promise<CatalogRow[]> {
    const cats = await db.categories.filter((c) => c.isActive && c.type === type).toArray();
    const byId = new Map(cats.map((c) => [c.id, c]));
    const parentIds = new Set(cats.map((c) => c.parentId).filter((id): id is string => Boolean(id)));

    return cats.map((c) => ({
        id: c.id,
        path: c.parentId && byId.get(c.parentId)
            ? `${byId.get(c.parentId)!.name} › ${c.name}`
            : c.name,
        isLeaf: !parentIds.has(c.id),
    }));
}

export type ParseLlmResult =
    | { ok: true; payload: LlmSuggestionPayload }
    | { ok: false; result: GeminiResult };

export function parseLlmSuggestion(text: string): ParseLlmResult {
    let parsed: unknown;
    try {
        parsed = extractJsonObject(text);
    } catch (err) {
        if (import.meta.env?.DEV) {
            console.debug('[parseLlmSuggestion] Rejected: invalid-json. Raw text:', text, 'Error:', err);
        }
        return { ok: false, result: { status: 'rejected', reason: 'invalid-json' } };
    }

    const schemaResult = LlmSuggestionSchema.safeParse(parsed);
    if (!schemaResult.success) {
        if (import.meta.env?.DEV) {
            console.debug('[parseLlmSuggestion] Rejected: invalid-schema. Parsed object:', parsed, 'Validation error:', schemaResult.error);
        }
        return { ok: false, result: { status: 'rejected', reason: 'invalid-schema' } };
    }

    return { ok: true, payload: schemaResult.data };
}

export function parseLlmSuggestionJson(text: string): LlmSuggestionPayload | null {
    const res = parseLlmSuggestion(text);
    return res.ok ? res.payload : null;
}

export async function loadRecentTransactionExamples(
    type: 'income' | 'expense',
    limit = 10
): Promise<Array<{ description: string; categoryPath: string }>> {
    try {
        const txs = await db.transactions
            .where('type')
            .equals(type)
            .reverse()
            .limit(40)
            .toArray();

        if (txs.length === 0) return [];

        const categories = await db.categories.toArray();
        const byId = new Map(categories.map((c) => [c.id, c]));

        const examples: Array<{ description: string; categoryPath: string }> = [];
        const seenDescriptions = new Set<string>();

        for (const tx of txs) {
            const desc = tx.description?.trim();
            if (!desc || !tx.categoryId) continue;
            const lowerDesc = desc.toLowerCase();
            if (seenDescriptions.has(lowerDesc)) continue;
            seenDescriptions.add(lowerDesc);

            const cat = byId.get(tx.categoryId);
            if (!cat) continue;

            const path = cat.parentId && byId.get(cat.parentId)
                ? `${byId.get(cat.parentId)!.name} › ${cat.name}`
                : cat.name;

            examples.push({ description: desc, categoryPath: path });
            if (examples.length >= limit) break;
        }

        return examples;
    } catch {
        return [];
    }
}

export function sanitizePii(text: string): string {
    return text
        // Email addresses
        .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL]')
        // Numbers with 6 or more consecutive digits (IDs, account/card numbers, phones)
        .replace(/\b\d{6,}\b/g, '[NUM]');
}

export function buildPrompt(
    description: string,
    type: 'income' | 'expense',
    catalog: CatalogRow[],
    recentExamples: Array<{ description: string; categoryPath: string }> = []
): string {
    const sanitizedDescription = sanitizePii(description);
    const lines = catalog
        .map((row) => `- ${row.id} | ${row.path}${row.isLeaf ? '' : ' (raíz)'}`)
        .join('\n');

    const historySection = recentExamples.length > 0
        ? [
            'historial de transacciones previas del usuario (aprende cómo categoriza este usuario en particular):',
            ...recentExamples.map((ex) => `- "${sanitizePii(ex.description)}" → ${ex.categoryPath}`),
        ].join('\n')
        : '';

    return [
        'Eres un Asesor Financiero Senior y Estratega en Gestión de Presupuesto, Desendeudamiento, Ahorro e Inversiones para finanzas personales en Colombia.',
        'Responde SOLO un objeto JSON con este esquema:',
        '{"match":"existing"|"create"|"none","categoryId":string|null,"parentName":string|null,"subcategoryName":string|null,"confidence":number,"reason":string}',
        'Reglas fundamentales:',
        '- PRIORIDAD TOTAL A CATEGORÍAS EXISTENTES: Clasifica el gasto basándote estrictamente en las categorías que existen en el catálogo del usuario y en sus transacciones previas.',
        '- Analiza el catálogo provisto: Si el usuario tiene categorías estándar (ej: "Niños › Transporte", "Educación", "Transporte › Taxis / Apps") o personalizadas (nombres de dependientes, mascotas o servicios específicos), selecciona la subcategoría más adecuada y específica.',
        '- Si la descripción encaja semánticamente en una categoría existente del catálogo (o según los patrones aprendidos en su historial de transacciones), DEBES responder match=existing con el categoryId exacto del catálogo.',
        '- match=create: SOLO si ninguna categoría existente del catálogo encaja para este gasto. En tal caso, parentName DEBE ser el nombre exacto de una categoría raíz que YA exista en el catálogo del usuario (ej: "Niños", "Transporte", "Educación", etc.); subcategoryName es la subcategoría nueva a crear.',
        '- match=none: si la descripción no tiene relación o no hay contexto suficiente.',
        '- reason: Una sola frase concisa y de alto valor (máx 130 caracteres) en español que justifique la categoría y dé un micro-consejo financiero experto según el tipo de movimiento (si es deuda/interés: enfoque avalancha/desendeudamiento; si es inversión/ahorro: interés compuesto/fondo de emergencia; si es gasto hormiga/prescindible: costo de oportunidad; si es ingreso/fijo: regla 50/30/20 u optimización).',
        '- No inventes IDs. No uses montos ni cuentas.',
        `tipo: ${type}`,
        `descripción: ${sanitizedDescription}`,
        'catálogo:',
        lines || '(vacío)',
        historySection,
    ].filter(Boolean).join('\n');
}

export async function mapLlmPayloadToSuggestion(
    payload: LlmSuggestionPayload,
    type: 'income' | 'expense',
    catalogIds: Set<string>,
    rootParentNames?: Set<string>
): Promise<GeminiResult> {
    const confidence = payload.confidence;
    const reason = payload.reason;

    if (payload.match === 'none') {
        if (import.meta.env?.DEV) {
            console.debug('[mapLlmPayloadToSuggestion] No match: model-none. Reason given by model:', reason);
        }
        return { status: 'no-match', reason: 'model-none' };
    }

    if (payload.match === 'existing') {
        let id = payload.categoryId;
        if (!id || !catalogIds.has(id)) {
            // Fallback: Gemini sometimes outputs category name or subcategory instead of raw catalog UUID
            const candidateName = payload.categoryId || payload.subcategoryName || payload.parentName;
            if (candidateName) {
                const subName = payload.subcategoryName?.trim() || undefined;
                const match = await findCategoryByPath(type, payload.parentName || candidateName, subName);
                if (match && catalogIds.has(match.id)) {
                    id = match.id;
                }
            }
        }
        if (!id || !catalogIds.has(id)) {
            if (import.meta.env?.DEV) {
                console.debug('[mapLlmPayloadToSuggestion] Rejected: invalid-category-id. Payload:', payload, 'Known catalog IDs:', Array.from(catalogIds));
            }
            return { status: 'rejected', reason: 'invalid-category-id' };
        }
        return {
            status: 'success',
            suggestion: {
                categoryId: id,
                categoryPath: await resolveCategoryPathLabel(id),
                confidence,
                reason,
                needsCategoryCreation: false,
                source: 'gemini',
            },
        };
    }

    const parentName = payload.parentName?.trim();
    if (!parentName) {
        if (import.meta.env?.DEV) {
            console.debug('[mapLlmPayloadToSuggestion] Rejected: invalid-schema (create missing parentName)');
        }
        return { status: 'rejected', reason: 'invalid-schema' };
    }
    const subcategoryName = payload.subcategoryName?.trim() || undefined;

    const existing = await findCategoryByPath(type, parentName, subcategoryName);
    if (existing) {
        return {
            status: 'success',
            suggestion: {
                categoryId: existing.id,
                categoryPath: await resolveCategoryPathLabel(existing.id),
                confidence,
                reason,
                needsCategoryCreation: false,
                source: 'gemini',
            },
        };
    }

    // Si Gemini propuso un parentName que ya existe como categoría activa en el árbol del usuario
    // (incluso si es una subcategoría con padre, ej. el usuario tiene "Hogar › Servicios"
    // y Gemini propuso parentName: "Servicios" o "Hogar"), mapeamos a esa categoría existente.
    const allActive = await db.categories.filter((c) => c.isActive && c.type === type).toArray();
    const existingNamedCategory = allActive.find(
        (c) => normalizeForMatch(c.name) === normalizeForMatch(parentName) || categoryNamesAreSimilar(c.name, parentName)
    );
    if (existingNamedCategory && existingNamedCategory.parentId) {
        return {
            status: 'success',
            suggestion: {
                categoryId: existingNamedCategory.id,
                categoryPath: await resolveCategoryPathLabel(existingNamedCategory.id),
                confidence,
                reason,
                needsCategoryCreation: false,
                source: 'gemini',
            },
        };
    }

    // Grounding: Si el modelo intenta crear bajo una categoría raíz que NO existe en la base de datos
    // del usuario, no permitimos crear raíces arbitrarias (ej. 'Niños').
    if (rootParentNames && !rootParentNames.has(normalizeForMatch(parentName))) {
        if (import.meta.env?.DEV) {
            console.debug('[mapLlmPayloadToSuggestion] Rejected: unknown-root. Proposed parentName:', parentName, 'Known root parents:', Array.from(rootParentNames));
        }
        return { status: 'rejected', reason: 'unknown-root' };
    }

    return {
        status: 'success',
        suggestion: {
            categoryId: null,
            categoryPath: formatCategoryPath(parentName, subcategoryName),
            confidence,
            reason,
            needsCategoryCreation: true,
            pendingCategory: { type, parentName, subcategoryName },
            source: 'gemini',
        },
    };
}

export async function suggestWithAiProvider(
    description: string,
    type: 'income' | 'expense',
    signal?: AbortSignal,
    onProgress?: (attempt: ModelAttempt, friendlyMessage: string) => void
): Promise<LlmResult> {
    const provider = getSelectedAiProvider();
    const apiKey = getAiApiKey(provider);
    if (!apiKey) {
        if (import.meta.env?.DEV) {
            console.debug(`[suggestWithAiProvider] Unavailable: no-api-key for ${provider}`);
        }
        return { status: 'unavailable', reason: 'no-api-key' };
    }

    const [catalog, recentExamples, rootCategories] = await Promise.all([
        loadCategoryCatalog(type),
        loadRecentTransactionExamples(type, 10),
        db.categories.filter((c) => c.isActive && c.type === type && !c.parentId).toArray(),
    ]);

    const client = createAiClient(provider, apiKey);
    let genResult: { ok: true; text: string; modelUsed: string; attempts?: ModelAttempt[]; provider: typeof provider } | { ok: false; result: LlmResult };

    try {
        const response = await client.generate({
            prompt: buildPrompt(description, type, catalog, recentExamples),
            signal,
            onProgress,
        });
        genResult = {
            ok: true,
            text: response.text,
            modelUsed: response.modelUsed,
            attempts: response.attempts,
            provider: response.provider,
        };
    } catch (err: unknown) {
        if (signal?.aborted) {
            return { status: 'error', reason: 'network-error' };
        }
        const errorReason = err instanceof Error && err.message.includes('401')
            ? 'http-401'
            : err instanceof Error && err.message.includes('429')
            ? 'http-429'
            : err instanceof Error && err.message.includes('timeout')
            ? 'timeout'
            : 'network-error';
        return { status: 'error', reason: errorReason };
    }

    const parseResult = parseLlmSuggestion(genResult.text);
    if (!parseResult.ok) {
        if (import.meta.env?.DEV) {
            console.debug(`[suggestWithAiProvider] Parsing failed on ${provider}:`, parseResult.result);
        }
        const res = parseResult.result;
        if (res.status === 'rejected' || res.status === 'no-match' || res.status === 'success') {
            res.modelUsed = genResult.modelUsed;
            res.providerUsed = genResult.provider;
            res.attempts = genResult.attempts;
        }
        return res;
    }

    const rootParentNames = new Set(rootCategories.map((c) => normalizeForMatch(c.name)));

    const mapped = await mapLlmPayloadToSuggestion(
        parseResult.payload,
        type,
        new Set(catalog.map((row) => row.id)),
        rootParentNames
    );

    if (mapped.status === 'success' || mapped.status === 'no-match' || mapped.status === 'rejected') {
        mapped.modelUsed = genResult.modelUsed;
        mapped.providerUsed = genResult.provider;
        mapped.attempts = genResult.attempts;
        if (mapped.status === 'success') {
            mapped.suggestion.source = genResult.provider;
        }
    }

    if (import.meta.env?.DEV) {
        console.debug(`[suggestWithAiProvider] Final mapped result for ${provider}:`, mapped);
    }
    return mapped;
}
