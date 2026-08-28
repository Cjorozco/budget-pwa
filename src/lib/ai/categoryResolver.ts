import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import type { Category } from '../types';
import { categoryNamesAreSimilar, normalizeForMatch } from './categoryRules';

const DEFAULT_COLORS = {
    income: ['#10b981', '#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b'],
    expense: ['#3b82f6', '#ef4444', '#ec4899', '#0ea5e9', '#64748b'],
};

function namesMatch(a: string, b: string): boolean {
    return normalizeForMatch(a) === normalizeForMatch(b);
}

export async function findCategoryByPath(
    type: 'income' | 'expense',
    parentName: string,
    subcategoryName?: string
): Promise<Category | null> {
    const categories = await db.categories.filter((c) => c.isActive && c.type === type).toArray();
    const parent =
        categories.find((c) => !c.parentId && namesMatch(c.name, parentName)) ??
        categories.find((c) => !c.parentId && categoryNamesAreSimilar(c.name, parentName));
    if (!parent) return null;

    if (!subcategoryName) return parent;

    const children = categories.filter((c) => c.parentId === parent.id);
    return (
        children.find((c) => namesMatch(c.name, subcategoryName)) ??
        children.find((c) => categoryNamesAreSimilar(c.name, subcategoryName, parent.name)) ??
        null
    );
}

export function formatCategoryPath(parentName: string, subcategoryName?: string): string {
    return subcategoryName ? `${parentName} › ${subcategoryName}` : parentName;
}

export async function resolveCategoryPathLabel(categoryId: string): Promise<string> {
    const cat = await db.categories.get(categoryId);
    if (!cat) return 'Sin categoría';
    if (!cat.parentId) return cat.name;
    const parent = await db.categories.get(cat.parentId);
    return parent ? formatCategoryPath(parent.name, cat.name) : cat.name;
}

/** Busca o crea la categoría (y subcategoría). Retorna el id de la hoja a usar en transacciones. */
export async function findOrCreateCategory(
    type: 'income' | 'expense',
    parentName: string,
    subcategoryName?: string,
    color?: string
): Promise<string> {
    const existing = await findCategoryByPath(type, parentName, subcategoryName);
    if (existing) return existing.id;

    return db.transaction('rw', db.categories, async () => {
        const categories = await db.categories.filter((c) => c.isActive && c.type === type).toArray();
        let parent =
            categories.find((c) => !c.parentId && namesMatch(c.name, parentName)) ??
            categories.find((c) => !c.parentId && categoryNamesAreSimilar(c.name, parentName));

        if (!parent) {
            const palette = DEFAULT_COLORS[type];
            const parentColor = color ?? palette[categories.filter((c) => !c.parentId).length % palette.length];
            parent = {
                id: uuidv4(),
                name: parentName,
                type,
                color: parentColor,
                usageCount: 0,
                isActive: true,
            };
            await db.categories.add(parent);
        }

        if (!subcategoryName) return parent.id;

        const refreshed = await db.categories.filter((c) => c.isActive && c.type === type).toArray();
        const child =
            refreshed.find((c) => c.parentId === parent!.id && namesMatch(c.name, subcategoryName)) ??
            refreshed.find(
                (c) =>
                    c.parentId === parent!.id &&
                    categoryNamesAreSimilar(c.name, subcategoryName, parent!.name)
            );
        if (child) return child.id;

        const childId = uuidv4();
        await db.categories.add({
            id: childId,
            name: subcategoryName,
            type,
            color: parent.color,
            parentId: parent.id,
            usageCount: 0,
            isActive: true,
        });
        return childId;
    });
}
