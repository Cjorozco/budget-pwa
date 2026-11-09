import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCategoryPath } from '@/lib/ai/categoryResolver';
import { deleteValidatedSuggestion } from '@/lib/ai/suggestionValidation';
import { addUserKeywordRule, deleteUserKeywordRule } from '@/lib/ai/userKeywordRules';
import { db } from '@/lib/db';
import { useTranslation } from '@/lib/i18n';
import type { Category } from '@/lib/types';
import { useUIStore } from '@/store/ui';

interface KeywordFormData {
    keyword: string;
    categoryId: string;
}

interface RuleRowProps {
    label: string;
    categoryPath: string;
    deleteLabel: string;
    onDelete: () => void;
}

function RuleRow({ label, categoryPath, deleteLabel, onDelete }: RuleRowProps) {
    return (
        <li className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-white break-words">{label}</p>
                <p className="text-xs text-slate-500 break-words">{categoryPath}</p>
            </div>
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-11 min-w-11 shrink-0 text-red-600 hover:text-red-700"
                aria-label={deleteLabel}
                onClick={onDelete}
            >
                <Trash2 size={14} />
            </Button>
        </li>
    );
}

function pathOf(category: Category, byId: Map<string, Category>): string {
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    return parent ? formatCategoryPath(parent.name, category.name) : category.name;
}

export function SuggestionRulesSection() {
    const { t } = useTranslation();
    const confirm = useUIStore((s) => s.confirm);
    const addToast = useUIStore((s) => s.addToast);

    const rules = useLiveQuery(() => db.userKeywordRules.toArray()) ?? [];
    const learned = useLiveQuery(() => db.suggestionValidations.toArray()) ?? [];
    const categories = useLiveQuery(() => db.categories.toArray()) ?? [];

    const schema = useMemo(
        () =>
            z.object({
                keyword: z.string().trim().min(3, t.categories.keywordTooShort),
                categoryId: z.string().min(1, t.categories.keywordCategoryRequired),
            }),
        [t]
    );

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<KeywordFormData>({
        resolver: zodResolver(schema),
        defaultValues: { keyword: '', categoryId: '' },
    });

    const byId = new Map(categories.map((c) => [c.id, c]));
    const active = categories.filter((c) => c.isActive);
    const parentsWithChildren = new Set(active.map((c) => c.parentId).filter(Boolean));
    const selectable = active
        .filter((c) => !parentsWithChildren.has(c.id))
        .map((c) => ({ id: c.id, type: c.type, path: pathOf(c, byId) }))
        .sort((a, b) => a.path.localeCompare(b.path));

    const pathById = (categoryId: string) => {
        const category = byId.get(categoryId);
        return category?.isActive ? pathOf(category, byId) : t.categories.unavailableCategory;
    };

    const onSubmit = async (data: KeywordFormData) => {
        try {
            await addUserKeywordRule(data);
            reset();
            addToast(t.categories.keywordSaved, 'success');
        } catch {
            addToast(t.common.error, 'error');
        }
    };

    const removeAfterConfirm = async (
        dialog: { title: string; message: string; name: string; done: string },
        remove: () => Promise<void>
    ) => {
        const ok = await confirm({
            title: dialog.title,
            message: dialog.message.replace('{name}', () => dialog.name),
            confirmLabel: t.common.delete,
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await remove();
            addToast(dialog.done, 'success');
        } catch {
            addToast(t.common.error, 'error');
        }
    };

    const sortedRules = [...rules].sort((a, b) => a.keyword.localeCompare(b.keyword));
    const sortedLearned = [...learned].sort((a, b) => a.normalizedDescription.localeCompare(b.normalizedDescription));
    const deleteLabel = (name: string) => `${t.common.delete} ${name}`;

    return (
        <div className="space-y-6">
            <section className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">{t.categories.keywordsTitle}</h3>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                    <Input
                        label={t.categories.keywordLabel}
                        placeholder={t.categories.keywordPlaceholder}
                        error={errors.keyword?.message}
                        {...register('keyword')}
                    />
                    <div className="space-y-2">
                        <label htmlFor="keyword-category" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t.categories.keywordCategoryLabel}
                        </label>
                        <select
                            id="keyword-category"
                            className="w-full min-h-11 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            {...register('categoryId')}
                        >
                            <option value="">{t.categories.selectSubcategory}</option>
                            {(['expense', 'income'] as const).map((type) => (
                                <optgroup key={type} label={type === 'income' ? t.transactions.incomeLabel : t.transactions.expenseLabel}>
                                    {selectable
                                        .filter((option) => option.type === type)
                                        .map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.path}
                                            </option>
                                        ))}
                                </optgroup>
                            ))}
                        </select>
                        {errors.categoryId && <p className="text-sm text-red-600">{errors.categoryId.message}</p>}
                    </div>
                    <Button type="submit" className="w-full" isLoading={isSubmitting}>
                        {t.categories.addKeyword}
                    </Button>
                </form>
                {sortedRules.length === 0 ? (
                    <p className="text-sm text-slate-500">{t.categories.noKeywords}</p>
                ) : (
                    <ul className="space-y-2">
                        {sortedRules.map((rule) => (
                            <RuleRow
                                key={rule.id}
                                label={rule.keyword}
                                categoryPath={pathById(rule.categoryId)}
                                deleteLabel={deleteLabel(rule.keyword)}
                                onDelete={() =>
                                    removeAfterConfirm(
                                        {
                                            title: t.categories.deleteKeywordTitle,
                                            message: t.categories.deleteKeywordMessage,
                                            name: rule.keyword,
                                            done: t.categories.keywordDeleted,
                                        },
                                        () => deleteUserKeywordRule(rule.id)
                                    )
                                }
                            />
                        ))}
                    </ul>
                )}
            </section>

            <section className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">{t.categories.learnedTitle}</h3>
                {sortedLearned.length === 0 ? (
                    <p className="text-sm text-slate-500">{t.categories.noLearned}</p>
                ) : (
                    <ul className="space-y-2">
                        {sortedLearned.map((record) => (
                            <RuleRow
                                key={record.id}
                                label={record.normalizedDescription}
                                categoryPath={record.categoryId ? pathById(record.categoryId) : record.categoryPath}
                                deleteLabel={deleteLabel(record.normalizedDescription)}
                                onDelete={() =>
                                    removeAfterConfirm(
                                        {
                                            title: t.categories.deleteLearnedTitle,
                                            message: t.categories.deleteLearnedMessage,
                                            name: record.normalizedDescription,
                                            done: t.categories.learnedDeleted,
                                        },
                                        () => deleteValidatedSuggestion(record.id)
                                    )
                                }
                            />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
