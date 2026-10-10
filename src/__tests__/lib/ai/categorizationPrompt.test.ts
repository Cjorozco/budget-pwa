import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { seedInitialData } from '@/lib/db/seed';
import { normalizeForMatch } from '@/lib/ai/categoryRules';
import { CATEGORY_CRITERIA_PATHS, getCategoryCriteria } from '@/lib/ai/categoryCriteria';
import {
    CATEGORIZATION_SYSTEM_PROMPT,
    buildPrompt,
    buildResponseSchema,
} from '@/lib/ai/categorizationPrompt';

describe('CATEGORIZATION_SYSTEM_PROMPT', () => {
    it('keeps the hybrid rules: existing first, create only under a root, none when unclear', () => {
        expect(CATEGORIZATION_SYSTEM_PROMPT).toContain('PRIORIDAD TOTAL A CATEGORÍAS EXISTENTES');
        expect(CATEGORIZATION_SYSTEM_PROMPT).toContain('match="none"');
        expect(CATEGORIZATION_SYSTEM_PROMPT).toMatch(/match="create".*categoría raíz/);
        expect(CATEGORIZATION_SYSTEM_PROMPT).toContain('JSON');
    });

    it('tells the model that the description is data, not instructions', () => {
        expect(CATEGORIZATION_SYSTEM_PROMPT).toMatch(/nunca como instrucciones/);
    });
});

describe('buildPrompt catalog', () => {
    it('adds contrastive guidance (cubre / no) to categories that have it', () => {
        const prompt = buildPrompt('Uber a casa', 'expense', [
            { id: 'id-trans', path: 'Transporte', isLeaf: false },
            { id: 'id-ropa-n', path: 'Niños › Ropa', isLeaf: true },
        ]);

        expect(prompt).toContain('- id-trans | Transporte (raíz) | cubre:');
        expect(prompt).toMatch(/id-trans .*no: .*Viajes/);
        expect(prompt).toMatch(/id-ropa-n .*no: ropa del propio usuario/);
    });

    it('gives "Otros" leaves a generic hint and leaves user-made categories without guidance', () => {
        const prompt = buildPrompt('algo', 'expense', [
            { id: 'id-otros', path: 'Vivienda › Otros', isLeaf: true },
            { id: 'id-sofia', path: 'Sofía › Ruta', isLeaf: true },
        ]);

        expect(prompt).toMatch(/id-otros .*cubre: solo si ninguna subcategoría específica/);
        expect(prompt).toContain('- id-sofia | Sofía › Ruta');
        expect(prompt).not.toMatch(/id-sofia .*cubre/);
    });

    it('puts the description last and marks an empty catalog', () => {
        const prompt = buildPrompt('pago netflix', 'expense', []);
        expect(prompt).toContain('(vacío)');
        expect(prompt.trimEnd().endsWith('descripción: pago netflix')).toBe(true);
    });
});

describe('buildResponseSchema', () => {
    it('restricts categoryId and parentName to the user\'s real ids and root names', () => {
        const schema = buildResponseSchema(['a', 'b', 'a'], ['Hogar', 'Hogar', 'Ocio']) as {
            properties: Record<string, { enum?: string[] }>;
            required: string[];
        };

        expect(schema.properties.categoryId.enum).toEqual(['a', 'b']);
        expect(schema.properties.parentName.enum).toEqual(['Hogar', 'Ocio']);
        expect(schema.properties.match.enum).toEqual(['existing', 'create', 'none']);
        expect(schema.required).toEqual(['match', 'confidence', 'reason']);
    });

    it('omits empty enums, which the API would reject', () => {
        const schema = buildResponseSchema([], []) as { properties: Record<string, { enum?: string[] }> };
        expect(schema.properties.categoryId).not.toHaveProperty('enum');
        expect(schema.properties.parentName).not.toHaveProperty('enum');
    });
});

describe('category criteria vs. the seeded categories', () => {
    let seededPaths: Set<string>;
    let rootPaths: string[];

    beforeEach(async () => {
        await db.categories.clear();
        await seedInitialData();
        const all = await db.categories.toArray();
        const byId = new Map(all.map((c) => [c.id, c]));
        const pathOf = (c: (typeof all)[number]) => (c.parentId ? `${byId.get(c.parentId)!.name} › ${c.name}` : c.name);
        seededPaths = new Set(all.map((c) => normalizeForMatch(pathOf(c))));
        rootPaths = all.filter((c) => !c.parentId).map((c) => c.name);
    });

    it('has criteria for every seeded root category', () => {
        expect(rootPaths.length).toBeGreaterThan(10);
        const missing = rootPaths.filter((name) => name !== 'Otros' && !getCategoryCriteria(name));
        expect(missing).toEqual([]);
    });

    it('has no criteria key pointing to a category that does not exist in the seed', () => {
        const dangling = CATEGORY_CRITERIA_PATHS.filter((key) => !seededPaths.has(key));
        expect(dangling).toEqual([]);
    });
});
