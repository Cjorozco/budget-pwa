import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { db } from '@/lib/db';
import { seedInitialData } from '@/lib/db/seed';
import { GEMINI_ATTEMPT_TIMEOUT_MS } from '@/lib/ai/geminiConfig';
import { suggestWithAiProvider } from '@/lib/ai/geminiSuggest';
import { GeminiProviderClient } from '@/lib/ai/gateway/geminiAdapter';
import { AI_MODEL_CHAINS } from '@/lib/ai/models';
import { GOLDEN_ITEMS } from './golden';
import { classifyOutcome, renderReport, summarize, type EvalRecord } from './metrics';

/**
 * Manual evaluation of the AI categorizer (not part of `npm test`). Run: `npm run eval:ai`.
 * The key is read from GEMINI_API_KEY (env or .env.local, which git ignores) and goes only to Google.
 * Results are written to ./eval-results/ (git ignored); nothing is sent anywhere else.
 *
 * Optional env: AI_EVAL_MODELS (comma list), AI_EVAL_LIMIT, AI_EVAL_CONCURRENCY, AI_EVAL_DELAY_MS.
 */
function readGeminiKey(): string | null {
    const fromEnv = process.env.GEMINI_API_KEY?.trim();
    if (fromEnv) return fromEnv;
    if (!existsSync('.env.local')) return null;
    const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

const key = readGeminiKey();
const models = (process.env.AI_EVAL_MODELS ?? AI_MODEL_CHAINS.gemini.map((m) => m.id).join(','))
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
const limit = Number(process.env.AI_EVAL_LIMIT ?? GOLDEN_ITEMS.length);
const concurrency = Math.max(1, Number(process.env.AI_EVAL_CONCURRENCY ?? 2));
const delayMs = Number(process.env.AI_EVAL_DELAY_MS ?? 400);
// Generous limits so latency is measured honestly; the report flags answers slower than production allows.
const EVAL_TIMEOUT_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const out = (text: string) => process.stdout.write(text + '\n');

async function runModel(model: string, apiKey: string): Promise<EvalRecord[]> {
    const client = new GeminiProviderClient(apiKey, { models: [model], timeoutMs: EVAL_TIMEOUT_MS, totalTimeoutMs: EVAL_TIMEOUT_MS });
    const items = GOLDEN_ITEMS.slice(0, limit);
    const records: EvalRecord[] = new Array(items.length);
    let next = 0;

    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            const item = items[index];
            const started = Date.now();
            let record: EvalRecord;
            try {
                const result = await suggestWithAiProvider(item.text, item.type, undefined, undefined, { client });
                record = { item, latencyMs: Date.now() - started, ...classifyOutcome(item, result) };
            } catch (err) {
                record = { item, latencyMs: Date.now() - started, outcome: 'error', got: err instanceof Error ? err.message : String(err) };
            }
            records[index] = record;
            if (delayMs > 0) await sleep(delayMs);
        }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    return records;
}

describe('AI categorizer evaluation', () => {
    it.skipIf(!key)('compares the configured models on the golden set', async () => {
        await db.categories.clear();
        await seedInitialData();

        const results = [];
        for (const model of models) {
            out(`Evaluando ${model}…`);
            const records = await runModel(model, key!);
            results.push({ model, records, summary: summarize(records, GEMINI_ATTEMPT_TIMEOUT_MS) });
        }

        const date = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        const report = renderReport(results, { date, capMs: GEMINI_ATTEMPT_TIMEOUT_MS, items: Math.min(limit, GOLDEN_ITEMS.length) });
        mkdirSync('eval-results', { recursive: true });
        writeFileSync(`eval-results/ai-categorization-${date}.md`, report);
        writeFileSync(
            `eval-results/ai-categorization-${date}.json`,
            JSON.stringify(results.map(({ model, summary, records }) => ({ model, summary, records })), null, 2)
        );
        out('\n' + report);
        out(`Reporte guardado en eval-results/ai-categorization-${date}.md`);
    }, 3_600_000);

    it.skipIf(Boolean(key))('needs GEMINI_API_KEY (env or .env.local)', () => {
        out('Sin GEMINI_API_KEY: se omite la evaluación.');
    });
});
