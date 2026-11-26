import { useState } from 'react';
import { subMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ReviewEvidence } from '@/components/finance/ReviewEvidence';
import { db } from '@/lib/db';
import { seedNameFor } from '@/lib/db/seedNames';
import { useTranslation } from '@/lib/i18n';
import { normalizeForMatch } from '@/lib/ai/categoryRules';
import { analyzeFinances, categoryPath, type ReviewMovement } from '@/lib/financeReview';
import { reviewCopy } from '@/lib/financeReviewCopy';
import { getMonthlyTotals } from '@/lib/reports/monthlyMetrics';
import { formatCurrency } from '@/lib/utils';

type Draft = ReturnType<typeof analyzeFinances>;
const selectClass = 'min-h-11 w-full rounded-lg border border-current/25 bg-surface px-3 text-text';

function ProposalActions({ disabled, onAccept, onDiscard }: {
    disabled?: boolean;
    onAccept: () => void;
    onDiscard: () => void;
}) {
    const { language } = useTranslation();
    const copy = reviewCopy(language);
    return (
        <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={disabled} onClick={onAccept}>{copy('accept')}</Button>
            <Button className="min-h-11" variant="ghost" onClick={onDiscard}>{copy('discard')}</Button>
        </div>
    );
}

function CategoryProposal({ matches, paths, initialName, parentId, reason, options }: {
    matches: ReviewMovement[];
    paths: string[];
    initialName?: string;
    parentId?: string;
    reason: 'overlap' | 'specific' | 'similar';
    options: string[];
}) {
    const { language, t } = useTranslation();
    const copy = reviewCopy(language);
    const [name, setName] = useState(initialName ?? options[0] ?? '');
    const [status, setStatus] = useState<'draft' | 'accepted' | 'discarded' | 'saved'>('draft');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const create = async () => {
        if (!parentId || !name.trim() || saving) return;
        setSaving(true);
        setError(false);
        try {
            await db.transaction('rw', db.categories, async () => {
                const parent = await db.categories.get(parentId);
                if (!parent?.isActive || parent.parentId || parent.type !== matches[0]?.type) throw new Error('Invalid parent');
                const siblings = await db.categories.filter((category) => category.parentId === parent.id).toArray();
                if (siblings.some((category) => category.isActive && normalizeForMatch(category.name) === normalizeForMatch(name))) return;
                await db.categories.add({
                    id: crypto.randomUUID(),
                    type: parent.type,
                    parentId: parent.id,
                    name: name.trim(),
                    color: parent.color,
                    usageCount: 0,
                    isActive: true,
                });
            });
            setStatus('saved');
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };
    if (status === 'discarded') return null;
    return (
        <article className="space-y-2 border-t border-current/15 py-3">
            <p className="font-medium break-words">{copy('before')} · {paths.join(' / ')}</p>
            <p className="text-sm">{copy(reason)}</p>
            <label className="block space-y-1 text-sm">
                <span>{copy('after')} · {copy('choosePath')}</span>
                {parentId
                    ? <Input className="min-h-11" value={name} maxLength={80} disabled={status !== 'draft'} onChange={(e) => setName(e.target.value)} />
                    : <select className={selectClass} value={name} disabled={status !== 'draft'} onChange={(e) => setName(e.target.value)}>
                        {options.map((path) => <option key={path}>{path}</option>)}
                    </select>}
            </label>
            <ReviewEvidence movements={matches} label={copy('related')} />
            <p className="text-sm text-text-muted">{copy('impact')}</p>
            {status === 'draft' && <ProposalActions disabled={!name.trim()} onAccept={() => setStatus('accepted')} onDiscard={() => setStatus('discarded')} />}
            {status === 'accepted' && (
                <div className="flex flex-wrap items-center gap-2">
                    {parentId
                        ? <Button className="min-h-11" disabled={saving} onClick={() => void create()}>{copy('confirmCategory')}</Button>
                        : <span role="status">{copy('accepted')}</span>}
                    <Button className="min-h-11" disabled={saving} variant="ghost" onClick={() => setStatus('draft')}>{t.common.edit}</Button>
                </div>
            )}
            {status === 'saved' && <p role="status">{t.categories.categoryCreated}</p>}
            {error && <p role="alert">{t.common.error}</p>}
        </article>
    );
}

type Purpose = 'unknown' | 'own' | 'help' | 'refund' | 'advance' | 'personal' | 'thirdParty';
const intentOptions: Record<ReviewMovement['type'], Purpose[]> = {
    income: ['unknown', 'own', 'help', 'refund', 'advance'],
    expense: ['unknown', 'personal', 'thirdParty'],
};
const labels = {
    advance: ['Otros › Gastos por encargo', 'Other › Payments on behalf of others', 'Autres › Paiements pour des tiers'],
    frequent: ['Fondos de terceros › Gastos por encargo', 'Third-party funds › Payments on behalf of others', 'Fonds de tiers › Paiements pour des tiers'],
    thirdParty: ['Gastos por encargo', 'Payments on behalf of others', 'Paiements pour des tiers'],
};

function PurposeProposal({ tx, draft }: { tx: ReviewMovement; draft: Draft }) {
    const { t, language } = useTranslation();
    const copy = reviewCopy(language);
    const [purpose, setPurpose] = useState<Purpose>('unknown');
    const [frequent, setFrequent] = useState(false);
    const pendingDescription = tx.type === 'income' ? `${tx.description} · ${copy('breakdownPending')}` : tx.description;
    const [description, setDescription] = useState(pendingDescription);
    const [status, setStatus] = useState<'draft' | 'accepted' | 'discarded'>('draft');
    const [copied, setCopied] = useState(false);
    const current = draft.catalog.get(tx.categoryId);
    const currentPath = current ? categoryPath(current, draft.catalog) : t.transactions.uncategorized;
    const options = [...draft.catalog.values()].filter((category) => category.type === tx.type && category.isActive
        && (!category.parentId || draft.catalog.get(category.parentId)?.isActive)).map((category) => categoryPath(category, draft.catalog));
    const routeKey = purpose === 'advance' && frequent ? 'frequent' : purpose;
    const canonicalPath = routeKey === 'help' ? ['Apoyos', 'Ayuda familiar'] : routeKey === 'refund' ? ['Otros', 'Reembolsos'] : undefined;
    const canonicalCategory = canonicalPath && [...draft.catalog.values()].find((category) =>
        category.isActive && category.type === tx.type && category.seedKey === canonicalPath.join(' › '));
    const suggestedPath = canonicalCategory ? categoryPath(canonicalCategory, draft.catalog)
        : canonicalPath ? canonicalPath.map((name) => seedNameFor(name, language)).join(' › ')
            : labels[routeKey as keyof typeof labels]?.[{ es: 0, en: 1, fr: 2 }[language]] ?? currentPath;
    const [editedPath, setEditedPath] = useState<string>();
    const proposedPath = editedPath ?? suggestedPath;
    const selectablePaths = [...new Set([proposedPath, ...options])];

    if (status === 'discarded') return null;
    return (
        <article className="space-y-3 border-t border-current/15 py-3">
            <p className="break-words font-medium">{copy('before')} · {tx.description} · {currentPath}</p>
            <p className="text-sm">{copy('pendingHint')}</p>
            <select aria-label={copy('pending')} className={selectClass} value={purpose} disabled={status !== 'draft'}
                onChange={(event) => {
                    const next = event.target.value as Purpose;
                    setPurpose(next);
                    setEditedPath(undefined);
                    setFrequent(false);
                    setDescription(next === 'unknown' ? pendingDescription : `${copy(next)} · ${tx.description}`);
                }}>
                {intentOptions[tx.type].map((option) => <option key={option} value={option}>{copy(option)}</option>)}
            </select>
            {purpose === 'unknown' && tx.type === 'income' && <p className="text-sm">{copy('mixedHint')}</p>}
            {purpose === 'advance' && (
                <select aria-label={copy('advance')} className={selectClass} value={String(frequent)} disabled={status !== 'draft'}
                    onChange={(event) => { setFrequent(event.target.value === 'true'); setEditedPath(undefined); }}>
                    <option value="false">{copy('occasional')}</option>
                    <option value="true">{copy('frequent')}</option>
                </select>
            )}
            {purpose !== 'unknown' && (
                <>
                    <label className="block space-y-1 text-sm">
                        <span>{copy('after')} · {tx.type === 'income' ? t.transactions.incomeLabel : t.transactions.expenseLabel}</span>
                        <select className={selectClass} value={proposedPath} disabled={status !== 'draft'} onChange={(e) => setEditedPath(e.target.value)}>
                            {selectablePaths.map((path) => <option key={path}>{path}</option>)}
                        </select>
                    </label>
                    {!options.includes(proposedPath) && <p className="text-sm text-text-muted">{copy('routeMissing')}</p>}
                    {['refund', 'advance', 'thirdParty'].includes(purpose) && <p className="text-sm">{copy('tagHint')}</p>}
                </>
            )}
            <label className="block space-y-1 text-sm">
                <span>{copy('description')}</span>
                <Input className="min-h-11" value={description} disabled={status !== 'draft'} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <ReviewEvidence movements={[tx]} label={copy('related')} />
            <p className="text-sm text-text-muted">{copy('impact')}</p>
            {status === 'draft'
                ? <ProposalActions disabled={!description.trim()} onAccept={() => setStatus('accepted')} onDiscard={() => setStatus('discarded')} />
                : <div className="flex flex-wrap items-center gap-2">
                    <span role="status">{copy('accepted')}</span>
                    {navigator.clipboard && (
                        <Button variant="outline" className="min-h-11" onClick={() => {
                            void navigator.clipboard.writeText(description.trim()).then(() => setCopied(true), () => setCopied(false));
                        }}>{copied ? t.common.copied : t.common.copy}</Button>
                    )}
                    <Button variant="ghost" className="min-h-11" onClick={() => { setStatus('draft'); setCopied(false); }}>{t.common.edit}</Button>
                </div>}
        </article>
    );
}

export function FinanceReview({ onClose }: { onClose: () => void }) {
    const { language, t } = useTranslation();
    const copy = reviewCopy(language);
    const [months, setMonths] = useState(3);
    const [draft, setDraft] = useState<Draft>();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(false);
    const [runId, setRunId] = useState(0);
    const totals = draft && getMonthlyTotals(draft.period);
    const pathFor = (id: string) => {
        const category = draft?.catalog.get(id);
        return category && draft ? categoryPath(category, draft.catalog) : t.transactions.uncategorized;
    };
    const run = async () => {
        setPending(true);
        setError(false);
        try {
            const end = new Date();
            const start = subMonths(end, months);
            const next = await db.transaction('r', db.transactions, db.categories, async () =>
                analyzeFinances(await db.transactions.toArray(), await db.categories.toArray(), start.getTime(), end.getTime()));
            setRunId((id) => id + 1);
            setDraft(next);
        } catch {
            setError(true);
        } finally {
            setPending(false);
        }
    };
    return (
        <Modal isOpen title={copy('title')} onClose={onClose}>
            <div className="space-y-5 text-text">
                <p className="text-sm text-text-muted">{copy('local')}</p>
                <div className="flex items-end gap-2">
                    <label className="min-w-0 flex-1 space-y-1 text-sm">
                        <span>{copy('period')}</span>
                        <select className={selectClass} value={months} disabled={pending} onChange={(e) => { setMonths(Number(e.target.value)); setDraft(undefined); }}>
                            <option value={1}>{copy('oneMonth')}</option>
                            {[3, 6, 12].map((value) => <option key={value} value={value}>{copy('months').replace('{n}', String(value))}</option>)}
                        </select>
                    </label>
                    <Button className="min-h-11" disabled={pending} onClick={() => void run()}>{pending ? t.common.loading : copy('run')}</Button>
                </div>
                {error && <p role="alert">{t.common.error}</p>}
                {draft && totals && (
                    <div className="space-y-5" key={runId}>
                        <section className="space-y-2">
                            <h3 className="font-semibold">{copy('registered')}</h3>
                            <p className="text-sm">{t.transactions.incomeLabel} {formatCurrency(totals.income)} · {t.transactions.expenseLabel} {formatCurrency(totals.expense)}</p>
                            <p className="text-sm">{copy('transferCount').replace('{n}', String(draft.transferCount))}</p>
                            <p className="text-sm text-text-muted">{copy('reportsNote')}</p>
                            {draft.reviewTransfers.length > 0 && <ReviewEvidence movements={draft.reviewTransfers} label={copy('transferIssue')} />}
                        </section>
                        {draft.usage.size > 0 && <section className="space-y-2">
                            <h3 className="font-semibold">{copy('usage')}</h3>
                            {[...draft.usage].sort((a, b) => b[1].length - a[1].length).map(([id, matches]) => (
                                <ReviewEvidence key={id} movements={matches} label={`${pathFor(id)} ({n})`} />
                            ))}
                            {draft.genericUsage.length > 0 && <p className="text-sm text-text-muted">
                                {copy('generic')} · {draft.genericUsage.map(({ category, matches }) => `${pathFor(category.id)} (${matches.length})`).join(' / ')}
                            </p>}
                        </section>}
                        {draft.uncertain.length > 0 && <section>
                            <h3 className="font-semibold">{copy('pending')}</h3>
                            {draft.uncertain.map((tx) => <PurposeProposal key={tx.id} tx={tx} draft={draft} />)}
                        </section>}
                        <section className="space-y-2">
                            <h3 className="font-semibold">{copy('patterns')}</h3>
                            {draft.patterns.length === 0 && draft.similarNames.length === 0 && <p className="text-sm">{copy('empty')}</p>}
                            {draft.patterns.map(({ kind, matches, category }) => {
                                const parent = category?.parentId ? draft.catalog.get(category.parentId) : category;
                                const parentId = kind === 'specific' && parent?.isActive ? parent.id : undefined;
                                const paths = [...new Set(matches.map((tx) => pathFor(tx.categoryId)))];
                                return <CategoryProposal key={matches[0].id} matches={matches} paths={paths} options={paths}
                                    reason={kind} parentId={parentId} initialName={parentId ? matches[0].description.trim().slice(0, 80) : undefined} />;
                            })}
                            {draft.similarNames.map(({ category, other, matches }) => {
                                const paths = [...new Set([pathFor(category.id), pathFor(other.id)])];
                                return <CategoryProposal key={`${category.id}:${other.id}`} matches={matches} paths={paths} options={paths} reason="similar" />;
                            })}
                        </section>
                        <Link className="inline-flex min-h-11 items-center underline underline-offset-4" to="/budget">{copy('budgetLink')}</Link>
                    </div>
                )}
            </div>
        </Modal>
    );
}
