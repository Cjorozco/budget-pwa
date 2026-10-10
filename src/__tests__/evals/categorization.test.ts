import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { seedInitialData } from '@/lib/db/seed';
import { normalizeForMatch } from '@/lib/ai/categoryRules';
import type { CategorySuggestion } from '@/lib/ai/categorizer';
import type { LlmResult } from '@/lib/ai/types';
import { GOLDEN_ITEMS, type GoldenItem } from '@/evals/categorization/golden';
import { classifyOutcome, percentile, renderReport, summarize, type EvalRecord } from '@/evals/categorization/metrics';

describe('golden set vs. the seeded categories', () => {
    let paths: Record<'income' | 'expense', Set<string>>;

    beforeEach(async () => {
        await db.categories.clear();
        await seedInitialData();
        const all = await db.categories.toArray();
        const byId = new Map(all.map((c) => [c.id, c]));
        paths = { income: new Set(), expense: new Set() };
        for (const c of all) {
            const path = c.parentId ? `${byId.get(c.parentId)!.name} › ${c.name}` : c.name;
            paths[c.type].add(normalizeForMatch(path));
        }
    });

    it('only expects categories that exist in the seed for its type', () => {
        const missing = GOLDEN_ITEMS.flatMap((item) =>
            (item.expected ?? []).filter((p) => !paths[item.type].has(normalizeForMatch(p))).map((p) => `${item.text} → ${p}`)
        );
        expect(missing).toEqual([]);
    });

    it('has no duplicate descriptions and covers every kind of case', () => {
        const texts = GOLDEN_ITEMS.map((i) => normalizeForMatch(i.text) + i.type);
        expect(new Set(texts).size).toBe(texts.length);

        const tags = new Set(GOLDEN_ITEMS.map((i) => i.tag));
        for (const tag of ['clear', 'confusable', 'colombia', 'ambiguous', 'injection', 'english', 'french', 'income']) {
            expect(tags.has(tag as GoldenItem['tag'])).toBe(true);
        }
        expect(GOLDEN_ITEMS.some((i) => i.expected === null)).toBe(true);
    });
});

const suggestion = (categoryPath: string, extra: Partial<CategorySuggestion> = {}): LlmResult => ({
    status: 'success',
    suggestion: { categoryId: 'id', categoryPath, confidence: 0.9, reason: 'x', needsCategoryCreation: false, ...extra },
});

const answerable: GoldenItem = { text: 'ropa niño', type: 'expense', tag: 'confusable', expected: ['Niños › Ropa'] };
const mustBeNone: GoldenItem = { text: 'asdfgh', type: 'expense', tag: 'ambiguous', expected: null };
const noneOrCreate: GoldenItem = { text: 'renta DIAN', type: 'expense', tag: 'colombia', expected: null, allowCreate: true };

describe('classifyOutcome', () => {
    it('separates right leaf, right root and wrong root, ignoring accents and case', () => {
        expect(classifyOutcome(answerable, suggestion('niños › ropa')).outcome).toBe('correct');
        expect(classifyOutcome(answerable, suggestion('Niños › Juguetes')).outcome).toBe('root-only');
        expect(classifyOutcome(answerable, suggestion('Gastos diarios › Ropa')).outcome).toBe('wrong');
    });

    it('treats a proposed new category as "created" when an existing one was expected', () => {
        const result = suggestion('Niños › Natación', { categoryId: null, needsCategoryCreation: true });
        expect(classifyOutcome(answerable, result).outcome).toBe('created');
    });

    it('rewards "none" only when nothing was expected, and allows create when flagged', () => {
        const none: LlmResult = { status: 'no-match', reason: 'model-none' };
        expect(classifyOutcome(mustBeNone, none).outcome).toBe('none-correct');
        expect(classifyOutcome(answerable, none).outcome).toBe('none-miss');
        expect(classifyOutcome(mustBeNone, suggestion('Ocio › Cine')).outcome).toBe('false-suggest');

        const create = suggestion('Vivienda › Impuestos', { categoryId: null, needsCategoryCreation: true });
        expect(classifyOutcome(noneOrCreate, create).outcome).toBe('none-correct');
        expect(classifyOutcome(mustBeNone, create).outcome).toBe('false-suggest');
    });

    it('maps rejected and failed answers', () => {
        expect(classifyOutcome(answerable, { status: 'rejected', reason: 'invalid-json' }).outcome).toBe('rejected');
        expect(classifyOutcome(answerable, { status: 'error', reason: 'timeout' }).outcome).toBe('error');
        expect(classifyOutcome(answerable, { status: 'unavailable', reason: 'no-api-key' }).outcome).toBe('error');
    });
});

describe('percentile', () => {
    it('uses the nearest-rank method and handles empty input', () => {
        const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        expect(percentile(values, 50)).toBe(50);
        expect(percentile(values, 95)).toBe(100);
        expect(percentile([], 95)).toBe(0);
    });
});

describe('summarize and renderReport', () => {
    const rec = (item: GoldenItem, outcome: EvalRecord['outcome'], latencyMs: number, confidence?: number, got?: string): EvalRecord => ({
        item,
        outcome,
        latencyMs,
        confidence,
        got,
    });

    const records: EvalRecord[] = [
        rec(answerable, 'correct', 1000, 0.9),
        rec({ ...answerable, text: 'b' }, 'root-only', 2000, 0.8, 'Niños › Juguetes'),
        rec({ ...answerable, text: 'c' }, 'wrong', 5000, 0.6, 'Ocio › Cine'),
        rec(mustBeNone, 'none-correct', 800),
        rec({ ...mustBeNone, text: 'd' }, 'false-suggest', 900, 0.7, 'Ocio › Cine'),
        rec({ ...answerable, text: 'e' }, 'error', 30000, undefined, 'timeout'),
    ];

    it('computes accuracy, none recall, errors, latency and confidence', () => {
        const s = summarize(records, 4000);

        expect(s.total).toBe(6);
        expect(s.answerable).toBe(4);
        expect(s.expectedNone).toBe(2);
        expect(s.accuracy).toBeCloseTo(1 / 4);
        expect(s.rootAccuracy).toBeCloseTo(2 / 4);
        expect(s.noneRecall).toBeCloseTo(1 / 2);
        expect(s.errorRate).toBeCloseTo(1 / 6);
        // errors are excluded from latency; 1 of 5 answers is above the 4 s cap
        expect(s.latency.max).toBe(5000);
        expect(s.latency.overCapPct).toBeCloseTo(1 / 5);
        expect(s.confidence.whenCorrect).toBeCloseTo(0.9);
        expect(s.confidence.whenWrong).toBeCloseTo(0.7);
        expect(s.byTag.confusable).toEqual({ total: 4, good: 1 });
    });

    it('renders a comparison table and lists the misses', () => {
        const report = renderReport(
            [{ model: 'model-x', summary: summarize(records, 4000), records }],
            { date: '2026-10-10-12-00', capMs: 4000, items: 6 }
        );

        expect(report).toContain('| model-x | 25% (1/4)');
        expect(report).toContain('## Fallos de model-x (4)');
        expect(report).toContain('"b" → root-only: obtuvo Niños › Juguetes; esperado Niños › Ropa');
        expect(report).toContain('esperado ninguna');
        // one record has an error, so the report must warn that the numbers are not comparable
        expect(report).toContain('Las cifras de acierto no son comparables');
    });
});
