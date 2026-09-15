import { z } from 'zod';

/**
 * Generic AI Suggestion Contract (Provider-Agnostic)
 * 
 * Supports outputs across multiple LLM providers (Google Gemini, OpenAI, Anthropic, Groq, Ollama, DeepSeek).
 * Gracefully normalizes property variations (reason/reasoning/explanation, camelCase/snake_case, 0-1/0-100 scores)
 * and infers missing match types.
 */
export const GenericLlmSuggestionSchema = z.preprocess((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return raw;
    const obj = raw as Record<string, unknown>;

    // 1. Normalize reason / reasoning / explanation / justification
    const reasonRaw = obj.reason ?? obj.reasoning ?? obj.explanation ?? obj.justification;
    const reason = reasonRaw !== undefined ? reasonRaw : 'Sugerencia de IA';

    // 2. Normalize categoryId / category_id / id
    const categoryId = obj.categoryId ?? obj.category_id ?? (obj.match === 'existing' ? obj.id : undefined);

    // 3. Normalize parentName / parent_name / category / rootCategory
    const parentName = obj.parentName ?? obj.parent_name ?? obj.category ?? obj.rootCategory;

    // 4. Normalize subcategoryName / subcategory_name / subcategory / subCategory
    const subcategoryName = obj.subcategoryName ?? obj.subcategory_name ?? obj.subcategory ?? obj.subCategory;

    // 5. Normalize confidence / score / prob
    const confidence = obj.confidence ?? obj.score ?? obj.prob;

    // 6. Infer match if omitted by generic LLM output
    let match = obj.match;
    if (!match || (match !== 'existing' && match !== 'create' && match !== 'none')) {
        if (categoryId && typeof categoryId === 'string' && categoryId.trim() !== '') {
            match = 'existing';
        } else if (parentName && typeof parentName === 'string' && parentName.trim() !== '') {
            match = 'create';
        } else if (obj.match === undefined && (obj.categoryId === null || obj.categoryId === undefined)) {
            match = 'none';
        }
    }

    return {
        ...obj,
        match,
        categoryId: categoryId ?? null,
        parentName: parentName ?? null,
        subcategoryName: subcategoryName ?? null,
        confidence: confidence ?? 0.7,
        reason,
    };
}, z.object({
    match: z.enum(['existing', 'create', 'none']),
    categoryId: z
        .string()
        .transform((v) => v.trim())
        .nullable()
        .optional(),
    parentName: z
        .string()
        .transform((v) => v.trim().slice(0, 100))
        .nullable()
        .optional(),
    subcategoryName: z
        .string()
        .transform((v) => v.trim().slice(0, 100))
        .nullable()
        .optional(),
    confidence: z.preprocess((val) => {
        if (typeof val === 'string') {
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) return parsed > 1 && parsed <= 100 ? parsed / 100 : parsed;
        } else if (typeof val === 'number') {
            return val > 1 && val <= 100 ? val / 100 : val;
        }
        return val;
    }, z.number().min(0).max(1)),
    reason: z
        .string()
        .transform((v) => v.trim().slice(0, 280))
        .refine((v) => v.length > 0, { message: 'Reason must not be empty' }),
}));

export type GenericLlmSuggestionPayload = z.infer<typeof GenericLlmSuggestionSchema>;
export type LlmSuggestionPayload = GenericLlmSuggestionPayload;

/** Backwards-compatible alias */
export const LlmSuggestionSchema = GenericLlmSuggestionSchema;

/**
 * Robust JSON extraction handling markdown code fences and conversational framing.
 */
export function extractJsonObject(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() ?? trimmed;

    try {
        return JSON.parse(candidate);
    } catch {
        const objMatch = candidate.match(/\{[\s\S]*\}/);
        if (objMatch) {
            return JSON.parse(objMatch[0]);
        }
        throw new Error('No valid JSON object structure found in response');
    }
}

export type ParseGenericLlmResult =
    | { ok: true; payload: GenericLlmSuggestionPayload }
    | { ok: false; reason: 'invalid-json' | 'invalid-schema' };

export function parseGenericLlmSuggestion(text: string): ParseGenericLlmResult {
    let parsed: unknown;
    try {
        parsed = extractJsonObject(text);
    } catch {
        return { ok: false, reason: 'invalid-json' };
    }

    const schemaResult = GenericLlmSuggestionSchema.safeParse(parsed);
    if (!schemaResult.success) {
        return { ok: false, reason: 'invalid-schema' };
    }

    return { ok: true, payload: schemaResult.data };
}
