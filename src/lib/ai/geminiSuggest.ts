import { z } from 'zod';
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
import {
    GEMINI_FALLBACK_MODELS,
    GEMINI_MODEL,
    GEMINI_TIMEOUT_MS,
    getGeminiGenerateUrl,
} from './geminiConfig';
import { getGeminiApiKey } from './geminiKey';
import type { GeminiResult } from './types';

export type { GeminiResult };
export type SuggestionResult = GeminiResult;

const GeminiApiEnvelopeSchema = z.object({
    candidates: z
        .array(
            z.object({
                content: z
                    .object({
                        parts: z.array(z.object({ text: z.string().optional() })).optional(),
                    })
                    .optional(),
            })
        )
        .optional(),
    error: z.object({ message: z.string().optional() }).optional(),
});

const LlmSuggestionSchema = z.object({
    match: z.enum(['existing', 'create', 'none']),
    categoryId: z.string().nullable().optional(),
    parentName: z.string().nullable().optional(),
    subcategoryName: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(280),
});

export type LlmSuggestionPayload = z.infer<typeof LlmSuggestionSchema>;

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

export function extractJsonObject(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced?.[1]?.trim() ?? trimmed;
    return JSON.parse(raw);
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
            'historial de transacciones previas del usuario (aprende cómo categoriza):',
            ...recentExamples.map((ex) => `- "${sanitizePii(ex.description)}" → ${ex.categoryPath}`),
        ].join('\n')
        : '';

    return [
        'Eres un asistente experto de categorización para un presupuesto personal en Colombia.',
        'Responde SOLO un objeto JSON con este esquema:',
        '{"match":"existing"|"create"|"none","categoryId":string|null,"parentName":string|null,"subcategoryName":string|null,"confidence":number,"reason":string}',
        'Reglas fundamentales:',
        '- PRIORIDAD TOTAL A CATEGORÍAS EXISTENTES: Muchos usuarios personalizan sus categorías (ej: "Hogar › Servicios" o "Servicios básicos" para luz/agua/gas; nombres de hijos como "Sofía", "Mateo" para gastos de dependientes).',
        '- Si la descripción encaja semánticamente en una categoría existente del usuario (ej: "Gases del caribe", "Vanti", "Enel" o "recibo de luz" encaja en "Hogar › Servicios" o "Servicios básicos"; "Uber al jardín" encaja en "Sofía › Ruta"), DEBES responder match=existing con el categoryId exacto del catálogo.',
        '- NUNCA inventes categorías raíz como "Niños" o "Servicios públicos" si el usuario ya tiene categorías personalizadas que cubran ese ámbito.',
        '- match=create: SOLO si realmente no hay ninguna categoría que encaje en el catálogo. En tal caso, parentName DEBE ser el nombre exacto de una categoría raíz que YA exista en el catálogo de la lista; subcategoryName es la hoja nueva.',
        '- match=none: si no encaja.',
        '- reason: una frase corta en español.',
        '- No inventes ids. No uses montos ni cuentas.',
        `tipo: ${type}`,
        `descripción: ${sanitizedDescription}`,
        'catálogo:',
        lines || '(vacío)',
        historySection,
    ].filter(Boolean).join('\n');
}

interface GenerateOptions {
    apiKey: string;
    prompt: string;
    signal?: AbortSignal;
    timeoutMs?: number;
}

export type GenerateGeminiTextResult =
    | { ok: true; text: string }
    | { ok: false; result: GeminiResult };

export async function generateGeminiText(options: GenerateOptions): Promise<GenerateGeminiTextResult> {
    const timeoutMs = options.timeoutMs ?? GEMINI_TIMEOUT_MS;
    const controller = new AbortController();
    let isTimedOut = false;
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);

    const timer = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
    }, timeoutMs);

    const modelsToTry = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];
    let lastErrorResult: GeminiResult = { status: 'error', reason: 'network-error' };

    try {
        for (let i = 0; i < modelsToTry.length; i++) {
            if (controller.signal.aborted) {
                const reason = isTimedOut ? 'timeout' : 'network-error';
                if (import.meta.env?.DEV) {
                    console.debug(`[generateGeminiText] Aborted (${reason})`);
                }
                return { ok: false, result: { status: 'error', reason } };
            }
            const model = modelsToTry[i];
            const url = getGeminiGenerateUrl(model);

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': options.apiKey,
                    },
                    referrerPolicy: 'no-referrer',
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: options.prompt }] }],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 2048,
                            responseMimeType: 'application/json',
                        },
                    }),
                });

                const json: unknown = await response.json().catch(() => null);
                const envelope = GeminiApiEnvelopeSchema.safeParse(json);

                if (!response.ok) {
                    if (import.meta.env?.DEV) {
                        console.debug(`[Gemini API error on ${model}] status: ${response.status}`, json);
                    }

                    if (response.status === 401) {
                        if (import.meta.env?.DEV) {
                            console.debug('[generateGeminiText] Error: http-401 (invalid API key). Stopping fallback.');
                        }
                        return { ok: false, result: { status: 'error', reason: 'http-401' } };
                    }
                    if (response.status === 429) {
                        lastErrorResult = { status: 'error', reason: 'http-429' };
                    } else if (response.status >= 500 && response.status <= 599) {
                        lastErrorResult = { status: 'error', reason: 'http-5xx' };
                    } else {
                        lastErrorResult = { status: 'error', reason: 'network-error' };
                    }

                    if (i < modelsToTry.length - 1) {
                        if (import.meta.env?.DEV) {
                            console.debug(`[generateGeminiText] Falling back from ${model} to next model...`);
                        }
                        continue;
                    }
                    if (import.meta.env?.DEV) {
                        console.debug('[generateGeminiText] All fallback models exhausted. Final error:', lastErrorResult);
                    }
                    return { ok: false, result: lastErrorResult };
                }

                const text = envelope.success
                    ? envelope.data.candidates?.[0]?.content?.parts?.[0]?.text
                    : undefined;

                if (text?.trim()) {
                    return { ok: true, text };
                }

                if (import.meta.env?.DEV) {
                    console.debug(`[generateGeminiText] Empty response text from ${model}`);
                }
                lastErrorResult = { status: 'rejected', reason: 'invalid-json' };
                if (i < modelsToTry.length - 1) continue;
                return { ok: false, result: lastErrorResult };
            } catch (err: unknown) {
                if (controller.signal.aborted) {
                    const reason = isTimedOut ? 'timeout' : 'network-error';
                    if (import.meta.env?.DEV) {
                        console.debug(`[generateGeminiText] Fetch aborted on ${model} (${reason})`);
                    }
                    return { ok: false, result: { status: 'error', reason } };
                }
                if (import.meta.env?.DEV) {
                    console.debug(`[Gemini API request failed on ${model}]`, err);
                }
                lastErrorResult = { status: 'error', reason: 'network-error' };
                if (i < modelsToTry.length - 1) {
                    continue;
                }
                return { ok: false, result: lastErrorResult };
            }
        }
        return { ok: false, result: lastErrorResult };
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
    }
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

export async function suggestWithGemini(
    description: string,
    type: 'income' | 'expense',
    signal?: AbortSignal
): Promise<GeminiResult> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        if (import.meta.env?.DEV) {
            console.debug('[suggestWithGemini] Unavailable: no-api-key');
        }
        return { status: 'unavailable', reason: 'no-api-key' };
    }

    const [catalog, recentExamples, rootCategories] = await Promise.all([
        loadCategoryCatalog(type),
        loadRecentTransactionExamples(type, 10),
        db.categories.filter((c) => c.isActive && c.type === type && !c.parentId).toArray(),
    ]);

    const genResult = await generateGeminiText({
        apiKey,
        prompt: buildPrompt(description, type, catalog, recentExamples),
        signal,
    });

    if (!genResult.ok) {
        if (import.meta.env?.DEV) {
            console.debug('[suggestWithGemini] Generation failed:', genResult.result);
        }
        return genResult.result;
    }

    const parseResult = parseLlmSuggestion(genResult.text);
    if (!parseResult.ok) {
        if (import.meta.env?.DEV) {
            console.debug('[suggestWithGemini] Parsing failed:', parseResult.result);
        }
        return parseResult.result;
    }

    const rootParentNames = new Set(rootCategories.map((c) => normalizeForMatch(c.name)));

    const mapped = await mapLlmPayloadToSuggestion(
        parseResult.payload,
        type,
        new Set(catalog.map((row) => row.id)),
        rootParentNames
    );

    if (import.meta.env?.DEV) {
        console.debug('[suggestWithGemini] Final mapped result:', mapped);
    }
    return mapped;
}

export async function testGeminiApiKey(apiKey: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const genResult = await generateGeminiText({
        apiKey,
        prompt: 'Responde exactamente {"match":"none","categoryId":null,"parentName":null,"subcategoryName":null,"confidence":0,"reason":"ok"}',
        timeoutMs: 8000,
    });

    if (!genResult.ok) {
        return {
            ok: false,
            message: `No se pudo contactar a Gemini (${GEMINI_MODEL}). Revisa la key, la red y que sea de Google AI Studio.`,
        };
    }

    const text = genResult.text;
    if (!parseLlmSuggestionJson(text) && !text.toLowerCase().includes('ok')) {
        return { ok: false, message: `Gemini respondió, pero no en el formato esperado (${GEMINI_MODEL}).` };
    }

    return { ok: true };
}
