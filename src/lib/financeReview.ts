import { format, subMonths, startOfMonth } from 'date-fns';
import { categoryNamesAreSimilar, normalizeForMatch } from './ai/categoryRules';
import { getItemMonth } from './budget';
import { roundMoney } from './money';
import type { BudgetItem, Category, Transaction } from './types';

export type ReviewMovement = Transaction & { type: 'income' | 'expense' };
interface CategoryPattern {
    kind: 'overlap' | 'specific';
    matches: ReviewMovement[];
    category?: Category;
}

export function isReviewMovement(tx: Transaction): tx is ReviewMovement {
    return tx.type !== 'transfer' && !tx.isAdjustment;
}

const purposeClue = /\b(reembolso\w*|reintegro\w*|devolucion\w*|anticipo\w*|encargo\w*|transferencia\w*|traspaso\w*|mama|papa|ayuda\w*|terceros|refund\w*|reimburs\w*|advance\w*|transfer\w*|third.party|on behalf|rembours\w*|avance\w*|virement\w*|tiers)\b/;

export function isPurposeUncertain(tx: ReviewMovement, context = '') {
    return tx.needsReview || tx.isAmbiguous || (tx.aiConfidence !== undefined && tx.aiConfidence < 0.7)
        || purposeClue.test(normalizeForMatch(`${tx.description} ${context}`));
}

export function categoryPath(category: Category, catalog: Map<string, Category>) {
    const parent = category.parentId && catalog.get(category.parentId);
    return parent ? `${parent.name} › ${category.name}` : category.name;
}

export function analyzeFinances(transactions: Transaction[], categories: Category[], start: number, end: number) {
    const period = transactions.filter((tx) => tx.date >= start && tx.date < end);
    const movements = period.filter(isReviewMovement);
    const catalog = new Map(categories.map((category) => [category.id, category]));
    const usage = new Map<string, ReviewMovement[]>();
    const descriptions = new Map<string, ReviewMovement[]>();

    for (const tx of movements) {
        const byCategory = usage.get(tx.categoryId) ?? [];
        byCategory.push(tx);
        usage.set(tx.categoryId, byCategory);
        const description = normalizeForMatch(tx.description.trim());
        if (!description) continue;
        const key = `${tx.type}:${description}`;
        const matching = descriptions.get(key) ?? [];
        matching.push(tx);
        descriptions.set(key, matching);
    }

    const generic = categories.filter((category) =>
        /(^| › )Otros$/.test(category.seedKey ?? '') ||
        /^(otros|other|autres)$/.test(normalizeForMatch(category.name)),
    );
    const genericIds = new Set(generic.map((category) => category.id));
    const genericUsage = generic.flatMap((category) => {
        const matches = usage.get(category.id);
        return matches?.length ? [{ category, matches }] : [];
    });
    const patterns = [...descriptions.values()].flatMap<CategoryPattern>((matches) => {
        const categoryIds = new Set(matches.map((tx) => tx.categoryId));
        const first = matches[0];
        const category = catalog.get(first.categoryId);
        if (categoryIds.size > 1) return [{ kind: 'overlap' as const, matches, category }];
        if (matches.length < 2 || !category?.isActive || !genericIds.has(category.id)) return [];
        return [{ kind: 'specific' as const, matches, category }];
    });
    const active = categories.filter((category) => category.isActive && !genericIds.has(category.id));
    const similarNames = active.flatMap((category, index) => active.slice(index + 1)
        .filter((other) => category.type === other.type
            && category.parentId === other.parentId
            && categoryNamesAreSimilar(category.name, other.name))
        .map((other) => ({ category, other, matches: [...(usage.get(category.id) ?? []), ...(usage.get(other.id) ?? [])] })));

    const transfers = new Map<string, Transaction[]>();
    // Use both sides even when one falls outside the review period.
    for (const tx of transactions) {
        if (tx.type !== 'transfer' || !tx.transferId) continue;
        const pair = transfers.get(tx.transferId) ?? [];
        pair.push(tx);
        transfers.set(tx.transferId, pair);
    }
    const validTransfer = (pair: Transaction[]) => pair.length === 2
        && pair[0].accountId !== pair[1].accountId && pair[0].amount === pair[1].amount
        && pair[0].amount > 0 && pair.some((tx) => tx.categoryId === 'transfer-in')
        && pair.some((tx) => tx.categoryId === 'transfer-out');
    const periodTransfers = period.filter((tx) => tx.type === 'transfer');
    const validIds = new Set([...transfers].filter(([, pair]) => validTransfer(pair)).map(([id]) => id));
    const reviewTransfers = periodTransfers.filter((tx) => !tx.transferId || !validIds.has(tx.transferId));
    const transferCount = new Set(periodTransfers.flatMap((tx) => tx.transferId && validIds.has(tx.transferId) ? [tx.transferId] : [])).size;

    return { period, catalog, usage, genericUsage, patterns, similarNames, reviewTransfers, transferCount,
        uncertain: movements.filter((tx) => {
            const category = catalog.get(tx.categoryId);
            return isPurposeUncertain(tx, category ? categoryPath(category, catalog) : '');
        }) };
}

export function findRecurringExpenses(
    transactions: Transaction[],
    categories: Category[],
    budget: BudgetItem[],
    targetMonth: Date,
) {
    const target = startOfMonth(targetMonth);
    const months = [3, 2, 1].map((offset) => format(subMonths(target, offset), 'yyyy-MM'));
    const planned = budget.filter((item) => item.type === 'expense' && getItemMonth(item) === format(target, 'yyyy-MM'));
    const catalog = new Map(categories.map((category) => [category.id, category]));
    const groups = new Map<string, ReviewMovement[]>();
    for (const tx of transactions) {
        if (!isReviewMovement(tx) || tx.type !== 'expense' || tx.amount <= 0) continue;
        const description = normalizeForMatch(tx.description.trim());
        if (!description || !months.includes(format(tx.date, 'yyyy-MM'))) continue;
        const key = `${tx.accountId}:\0${description}`;
        const group = groups.get(key) ?? [];
        group.push(tx);
        groups.set(key, group);
    }
    return [...groups.entries()].flatMap(([key, matches]) => {
        if (matches.length !== months.length || new Set(matches.map((tx) => format(tx.date, 'yyyy-MM'))).size !== months.length) return [];
        const latest = matches.reduce((a, b) => a.date > b.date ? a : b);
        const category = catalog.get(latest.categoryId);
        if (!category?.isActive || category.type !== 'expense' || matches.some((tx) => tx.categoryId !== category.id)) return [];
        const path = categoryPath(category, catalog);
        if (matches.some((tx) => isPurposeUncertain(tx, path))) return [];
        if (planned.some((item) => isBudgetExpenseCovered(item, category, path, [latest.description]))) return [];
        const amounts = matches.map((tx) => tx.amount).sort((a, b) => a - b);
        if (amounts[2] - amounts[0] > amounts[1] * 0.15) return [];
        return [{ key, matches, path,
            candidate: { name: latest.description, amount: roundMoney(amounts[1]), type: 'expense' as const, categoryId: category.id } }];
    }).sort((a, b) => b.candidate.amount - a.candidate.amount);
}

export function isBudgetExpenseCovered(item: BudgetItem, category: Category, path: string, names: string[]) {
    const name = normalizeForMatch(item.name);
    return names.some((candidate) => normalizeForMatch(candidate) === name)
        || normalizeForMatch(path) === name
        || (normalizeForMatch(category.name) === name && (!item.categoryId || item.categoryId === category.id));
}
