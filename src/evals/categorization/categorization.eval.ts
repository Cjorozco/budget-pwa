import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
// The free tier throttles requests per minute; stay under it so quota errors do not pollute the results.
const requestsPerMinute = Math.max(1, Number(process.env.AI_EVAL_RPM ?? 10));
const minIntervalMs = 60_000 / requestsPerMinute;
const MAX_QUOTA_RETRIES = 3;
const QUOTA_BACKOFF_MS = 20_000;
// Generous limits so latency is measured honestly; the report flags answers slower than production allows.
const EVAL_TIMEOUT_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const out = (text: string) => process.stdout.write(text + '\n');

// Vitest buffers worker output; a progress file shows what is happening during a long run.
const progress = (text: string) => {
    mkdirSync('eval-results', { recursive: true });
    appendFileSync('eval-results/progress.log', `${new Date().toISOString().slice(11, 19)} ${text}\n`);
};

let nextSlot = 0;
async function waitForSlot(): Promise<void> {
    const now = Date.now();
    const start = Math.max(now, nextSlot);
    nextSlot = start + minIntervalMs;
    if (start > now) await sleep(start - now);
}

async function runModel(model: string, apiKey: string): Promise<EvalRecord[]> {
    const client = new GeminiProviderClient(apiKey, { models: [model], timeoutMs: EVAL_TIMEOUT_MS, totalTimeoutMs: EVAL_TIMEOUT_MS });
    const items = GOLDEN_ITEMS.slice(0, limit);
    const records: EvalRecord[] = new Array(items.length);
    let next = 0;
    let done = 0;

    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            const item = items[index];
            let record!: EvalRecord;
            for (let attempt = 0; attempt <= MAX_QUOTA_RETRIES; attempt++) {
                await waitForSlot();
                const started = Date.now();
                try {
                    const result = await suggestWithAiProvider(item.text, item.type, undefined, undefined, { client });
                    record = { item, latencyMs: Date.now() - started, ...classifyOutcome(item, result) };
                } catch (err) {
                    record = { item, latencyMs: Date.now() - started, outcome: 'error', got: err instanceof Error ? err.message : String(err) };
                }
                const quotaHit = record.outcome === 'error' && record.got === 'http-429';
                if (!quotaHit || attempt === MAX_QUOTA_RETRIES) break;
                progress(`${model} cuota (429) en "${item.text.slice(0, 30)}": espero ${(QUOTA_BACKOFF_MS * (attempt + 1)) / 1000}s y reintento`);
                await sleep(QUOTA_BACKOFF_MS * (attempt + 1));
            }
            records[index] = record;
            done++;
            progress(`${model} ${done}/${items.length} ${record.outcome} ${record.latencyMs}ms "${item.text.slice(0, 40)}"`);
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
            progress(`== ${model}: inicio`);
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
