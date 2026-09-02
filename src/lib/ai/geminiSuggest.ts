import { z } from 'zod';
import { db } from '../db';
import type { CategorySuggestion } from './categorizer';
import {
    findCategoryByPath,
    formatCategoryPath,
    resolveCategoryPathLabel,
} from './categoryResolver';
import {
    GEMINI_GENERATE_URL,
    GEMINI_MODEL,
    GEMINI_TIMEOUT_MS,
} from './geminiConfig';
import { getGeminiApiKey } from './geminiKey';

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

export function parseLlmSuggestionJson(text: string): LlmSuggestionPayload | null {
    try {
        const parsed = extractJsonObject(text);
        const result = LlmSuggestionSchema.safeParse(parsed);
        return result.success ? result.data : null;
    } catch {
        return null;
    }
}

function buildPrompt(
    description: string,
    type: 'income' | 'expense',
    catalog: CatalogRow[]
): string {
    const lines = catalog
        .map((row) => `- ${row.id} | ${row.path}${row.isLeaf ? '' : ' (raíz)'}`)
        .join('\n');

    return [
        'Eres un asistente de categorización para un presupuesto personal en Colombia.',
        'Responde SOLO un objeto JSON con este esquema:',
        '{"match":"existing"|"create"|"none","categoryId":string|null,"parentName":string|null,"subcategoryName":string|null,"confidence":number,"reason":string}',
        'Reglas:',
        '- match=existing: categoryId DEBE ser un id de la lista. Prefiere hojas, no raíces.',
        '- match=create: parentName debe coincidir con una categoría de la lista; subcategoryName es la hoja nueva.',
        '- match=none: no encaja con el catálogo.',
        '- reason: una frase corta en español.',
        '- No inventes ids. No uses montos ni cuentas.',
        `tipo: ${type}`,
        `descripción: ${description}`,
        'catálogo:',
        lines || '(vacío)',
    ].join('\n');
}

interface GenerateOptions {
    apiKey: string;
    prompt: string;
    signal?: AbortSignal;
    timeoutMs?: number;
}

export async function generateGeminiText(options: GenerateOptions): Promise<string | null> {
    const timeoutMs = options.timeoutMs ?? GEMINI_TIMEOUT_MS;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);

    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `${GEMINI_GENERATE_URL}?key=${encodeURIComponent(options.apiKey)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            referrerPolicy: 'no-referrer',
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: options.prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 256,
                    responseMimeType: 'application/json',
                },
            }),
        });

        const json: unknown = await response.json().catch(() => null);
        const envelope = GeminiApiEnvelopeSchema.safeParse(json);

        if (!response.ok) {
            return null;
        }

        const text = envelope.success
            ? envelope.data.candidates?.[0]?.content?.parts?.[0]?.text
            : undefined;

        return text?.trim() ? text : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
    }
}

export async function mapLlmPayloadToSuggestion(
    payload: LlmSuggestionPayload,
    type: 'income' | 'expense',
    catalogIds: Set<string>
): Promise<CategorySuggestion | null> {
    const confidence = payload.confidence;
    const reason = payload.reason;

    if (payload.match === 'none') return null;

    if (payload.match === 'existing') {
        const id = payload.categoryId;
        if (!id || !catalogIds.has(id)) return null;
        return {
            categoryId: id,
            categoryPath: await resolveCategoryPathLabel(id),
            confidence,
            reason,
            needsCategoryCreation: false,
            source: 'gemini',
        };
    }

    const parentName = payload.parentName?.trim();
    if (!parentName) return null;
    const subcategoryName = payload.subcategoryName?.trim() || undefined;

    const existing = await findCategoryByPath(type, parentName, subcategoryName);
    if (existing) {
        return {
            categoryId: existing.id,
            categoryPath: await resolveCategoryPathLabel(existing.id),
            confidence,
            reason,
            needsCategoryCreation: false,
            source: 'gemini',
        };
    }

    return {
        categoryId: null,
        categoryPath: formatCategoryPath(parentName, subcategoryName),
        confidence,
        reason,
        needsCategoryCreation: true,
        pendingCategory: { type, parentName, subcategoryName },
        source: 'gemini',
    };
}

export async function suggestWithGemini(
    description: string,
    type: 'income' | 'expense',
    signal?: AbortSignal
): Promise<CategorySuggestion | null> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return null;

    const catalog = await loadCategoryCatalog(type);
    const text = await generateGeminiText({
        apiKey,
        prompt: buildPrompt(description, type, catalog),
        signal,
    });
    if (!text) return null;

    const payload = parseLlmSuggestionJson(text);
    if (!payload) return null;

    return mapLlmPayloadToSuggestion(
        payload,
        type,
        new Set(catalog.map((row) => row.id))
    );
}

export async function testGeminiApiKey(apiKey: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const text = await generateGeminiText({
        apiKey,
        prompt: 'Responde exactamente {"match":"none","categoryId":null,"parentName":null,"subcategoryName":null,"confidence":0,"reason":"ok"}',
        timeoutMs: 8000,
    });

    if (!text) {
        return {
            ok: false,
            message: `No se pudo contactar a Gemini (${GEMINI_MODEL}). Revisa la key, la red y que sea de Google AI Studio.`,
        };
    }

    if (!parseLlmSuggestionJson(text) && !text.toLowerCase().includes('ok')) {
        return { ok: false, message: `Gemini respondió, pero no en el formato esperado (${GEMINI_MODEL}).` };
    }

    return { ok: true };
}
