import { normalizeForMatch } from '@/lib/ai/categoryRules';
import type { LlmResult } from '@/lib/ai/types';
import type { GoldenItem, GoldenTag } from './golden';

export type Outcome =
    | 'correct'        // right leaf
    | 'root-only'      // right root, wrong leaf
    | 'wrong'          // wrong root
    | 'created'        // proposed a new category where an existing one was expected
    | 'none-correct'   // said "none" when none was expected (or an allowed create)
    | 'none-miss'      // said "none" but a category was expected
    | 'false-suggest'  // suggested a category where "none" was expected
    | 'rejected'       // answer failed validation (invalid json/schema/id/root)
    | 'error';         // no answer: timeout, quota, key, network

export interface EvalRecord {
    item: GoldenItem;
    outcome: Outcome;
    latencyMs: number;
    confidence?: number;
    got?: string;
    errorReason?: string;
}

const rootOf = (path: string): string => normalizeForMatch(path).split(' › ')[0];

export function classifyOutcome(item: GoldenItem, result: LlmResult): { outcome: Outcome; confidence?: number; got?: string } {
    switch (result.status) {
        case 'error':
        case 'unavailable':
            return { outcome: 'error', got: result.reason };
        case 'rejected':
            return { outcome: 'rejected', got: result.reason };
        case 'no-match':
            return { outcome: item.expected === null ? 'none-correct' : 'none-miss', got: 'none' };
        case 'success': {
            const { suggestion } = result;
            const confidence = suggestion.confidence;
            if (suggestion.needsCategoryCreation) {
                const got = `crear: ${suggestion.categoryPath}`;
                if (item.expected === null) return { outcome: item.allowCreate ? 'none-correct' : 'false-suggest', confidence, got };
                return { outcome: 'created', confidence, got };
            }
            const got = suggestion.categoryPath;
            if (item.expected === null) return { outcome: 'false-suggest', confidence, got };
            const normalizedGot = normalizeForMatch(got);
            if (item.expected.some((p) => normalizeForMatch(p) === normalizedGot)) return { outcome: 'correct', confidence, got };
            if (item.expected.some((p) => rootOf(p) === rootOf(got))) return { outcome: 'root-only', confidence, got };
            return { outcome: 'wrong', confidence, got };
        }
    }
}

export function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index];
}

const mean = (values: number[]): number | null =>
    values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

export interface Summary {
    total: number;
    answerable: number;
    expectedNone: number;
    counts: Record<Outcome, number>;
    /** Right leaf / answerable. */
    accuracy: number;
    /** Right root (leaf right or not) / answerable. */
    rootAccuracy: number;
    /** Said "none" (or an allowed create) / expectedNone. */
    noneRecall: number;
    errorRate: number;
    latency: { p50: number; p95: number; max: number; overCapPct: number };
    confidence: { whenCorrect: number | null; whenWrong: number | null };
    byTag: Partial<Record<GoldenTag, { total: number; good: number }>>;
}

const OUTCOMES: Outcome[] = ['correct', 'root-only', 'wrong', 'created', 'none-correct', 'none-miss', 'false-suggest', 'rejected', 'error'];

const ratio = (a: number, b: number): number => (b === 0 ? 0 : a / b);

/** `capMs` is the production per-attempt timeout; answers slower than it would not be used in the app. */
export function summarize(records: EvalRecord[], capMs: number): Summary {
    const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
    for (const r of records) counts[r.outcome]++;

    const answerable = records.filter((r) => r.item.expected !== null).length;
    const expectedNone = records.length - answerable;
    const answered = records.filter((r) => r.outcome !== 'error');
    const latencies = answered.map((r) => r.latencyMs);

    const byTag: Summary['byTag'] = {};
    for (const r of records) {
        const bucket = (byTag[r.item.tag] ??= { total: 0, good: 0 });
        bucket.total++;
        if (r.outcome === 'correct' || r.outcome === 'none-correct') bucket.good++;
    }

    return {
        total: records.length,
        answerable,
        expectedNone,
        counts,
        accuracy: ratio(counts.correct, answerable),
        rootAccuracy: ratio(counts.correct + counts['root-only'], answerable),
        noneRecall: ratio(counts['none-correct'], expectedNone),
        errorRate: ratio(counts.error, records.length),
        latency: {
            p50: percentile(latencies, 50),
            p95: percentile(latencies, 95),
            max: latencies.length ? Math.max(...latencies) : 0,
            overCapPct: ratio(latencies.filter((l) => l > capMs).length, latencies.length),
        },
        confidence: {
            whenCorrect: mean(records.filter((r) => r.outcome === 'correct' && r.confidence !== undefined).map((r) => r.confidence!)),
            whenWrong: mean(records.filter((r) => (r.outcome === 'wrong' || r.outcome === 'root-only') && r.confidence !== undefined).map((r) => r.confidence!)),
        },
        byTag,
    };
}

const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;
const conf = (n: number | null): string => (n === null ? '–' : n.toFixed(2));

export function renderReport(
    results: Array<{ model: string; summary: Summary; records: EvalRecord[] }>,
    meta: { date: string; capMs: number; items: number }
): string {
    const lines: string[] = [];
    lines.push(`# Evaluación del categorizador IA — ${meta.date}`);
    lines.push('');
    lines.push(`${meta.items} descripciones etiquetadas. Latencias medidas sin límite de tiempo; el tope de producción por intento es ${meta.capMs} ms.`);
    lines.push('Muestra pequeña: sirve para comparar modelos entre sí, no como métrica absoluta de calidad.');
    lines.push('');
    lines.push('| Modelo | Acierto hoja | Acierto raíz | "Ninguna" bien | Errores | p50 | p95 | máx | > tope | Conf. aciertos | Conf. fallos |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const { model, summary: s } of results) {
        lines.push(
            `| ${model} | ${pct(s.accuracy)} (${s.counts.correct}/${s.answerable}) | ${pct(s.rootAccuracy)} | ${pct(s.noneRecall)} (${s.counts['none-correct']}/${s.expectedNone}) | ${s.counts.error + s.counts.rejected} | ${s.latency.p50} ms | ${s.latency.p95} ms | ${s.latency.max} ms | ${pct(s.latency.overCapPct)} | ${conf(s.confidence.whenCorrect)} | ${conf(s.confidence.whenWrong)} |`
        );
    }
    lines.push('');
    lines.push('## Por tipo de caso (aciertos / total)');
    lines.push('');
    const tags = [...new Set(results.flatMap((r) => Object.keys(r.summary.byTag)))] as GoldenTag[];
    lines.push(`| Modelo | ${tags.join(' | ')} |`);
    lines.push(`|---|${tags.map(() => '---').join('|')}|`);
    for (const { model, summary: s } of results) {
        lines.push(`| ${model} | ${tags.map((t) => (s.byTag[t] ? `${s.byTag[t]!.good}/${s.byTag[t]!.total}` : '–')).join(' | ')} |`);
    }
    for (const { model, records } of results) {
        const misses = records.filter((r) => r.outcome !== 'correct' && r.outcome !== 'none-correct');
        lines.push('');
        lines.push(`## Fallos de ${model} (${misses.length})`);
        lines.push('');
        for (const r of misses) {
            const expected = r.item.expected ? r.item.expected.join(' | ') : 'ninguna';
            lines.push(`- "${r.item.text}" → ${r.outcome}: obtuvo ${r.got ?? '–'}; esperado ${expected}`);
        }
    }
    return lines.join('\n') + '\n';
}
