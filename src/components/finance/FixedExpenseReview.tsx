import { useEffect, useState } from 'react';
import { format, startOfMonth, subMonths } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { ReviewEvidence } from './ReviewEvidence';
import { db } from '@/lib/db';
import { candidatesToBudgetItems, getItemMonth } from '@/lib/budget';
import { findRecurringExpenses, isBudgetExpenseCovered } from '@/lib/financeReview';
import { reviewCopy } from '@/lib/financeReviewCopy';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { useUIStore } from '@/store/ui';

type Candidate = ReturnType<typeof findRecurringExpenses>[number];

function ExpenseProposal({ item, month }: { item: Candidate; month: string }) {
    const { t, language } = useTranslation();
    const copy = reviewCopy(language);
    const addToast = useUIStore((store) => store.addToast);
    const [name, setName] = useState(item.candidate.name);
    const [amount, setAmount] = useState(item.candidate.amount);
    const [accepted, setAccepted] = useState(false);
    const [discarded, setDiscarded] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<'duplicate' | 'error'>();

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (saving || !accepted || !name.trim() || !Number.isFinite(amount) || amount <= 0) return;
        setSaving(true);
        setError(undefined);
        try {
            const result = await db.transaction('rw', db.budgetItems, db.categories, async () => {
                const category = await db.categories.get(item.candidate.categoryId);
                if (!category?.isActive || category.type !== 'expense') throw new Error('Invalid category');
                const items = await db.budgetItems.filter((entry) => entry.type === 'expense' && getItemMonth(entry) === month).toArray();
                if (items.some((entry) => isBudgetExpenseCovered(entry, category, item.path, [item.candidate.name, name]))) return false;
                await db.budgetItems.bulkAdd(candidatesToBudgetItems([{ ...item.candidate, name: name.trim(), amount }], month));
                return true;
            });
            if (result) {
                setSaved(true);
                addToast(copy('budgetSaved'), 'success');
            } else {
                setError('duplicate');
            }
        } catch {
            setError('error');
        } finally {
            setSaving(false);
        }
    };
    if (discarded) return null;
    return (
        <form onSubmit={save} className="space-y-3 border-t border-current/15 py-3">
            <h3 className="font-semibold break-words">{item.candidate.name}</h3>
            <p className="text-sm">{item.path} · {formatCurrency(item.candidate.amount)} · {month}</p>
            <p className="text-sm">{copy('budgetBefore')}</p>
            <ReviewEvidence movements={item.matches} label={copy('related')} />
            <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                    <span>{copy('after')} · {t.budget.itemNameLabel}</span>
                    <Input className="min-h-11" value={name} disabled={saved || saving} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="space-y-1 text-sm">
                    <span>{t.budget.itemAmountLabel}</span>
                    <MoneyInput className="min-h-11 w-full" value={amount} disabled={saved || saving} onValueChange={(value) => setAmount(value ?? 0)} />
                </label>
            </div>
            <p className="text-sm text-text-muted">{copy('budgetImpact')}</p>
            {saved ? <p role="status">{copy('budgetSaved')}</p> : (
                <div className="flex flex-wrap gap-2">
                    {accepted
                        ? <Button className="min-h-11" type="submit" disabled={saving || !name.trim() || amount <= 0}>{t.budget.saveBtn}</Button>
                        : <Button className="min-h-11" type="button" onClick={() => setAccepted(true)}>{copy('budgetAdd')}</Button>}
                    <Button className="min-h-11" variant="ghost" type="button" disabled={saving} onClick={() => setDiscarded(true)}>{copy('discard')}</Button>
                </div>
            )}
            {error && <p role="alert">{error === 'duplicate' ? copy('budgetDuplicate') : t.common.error}</p>}
        </form>
    );
}

export function FixedExpenseReview({ month, onClose }: { month: Date; onClose: () => void }) {
    const { t, language } = useTranslation();
    const copy = reviewCopy(language);
    const [candidates, setCandidates] = useState<Candidate[]>();
    const [error, setError] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const end = startOfMonth(month);
        const start = subMonths(end, 3);
        void db.transaction('r', db.transactions, db.categories, db.budgetItems, async () =>
            findRecurringExpenses(
                await db.transactions.where('date').between(start.getTime(), end.getTime(), true, false).toArray(),
                await db.categories.toArray(),
                await db.budgetItems.toArray(),
                month,
            )).then((result) => {
            if (!cancelled) setCandidates(result);
        }, () => {
            if (!cancelled) setError(true);
        });
        return () => { cancelled = true; };
    }, [month]);
    return (
        <Modal isOpen title={copy('budgetAction')} onClose={onClose}>
            <div className="space-y-3 text-text">
                <p className="text-sm text-text-muted">{copy('budgetHint')}</p>
                {error && <p role="alert">{t.common.error}</p>}
                {!candidates && !error && <p role="status">{t.common.loading}</p>}
                {candidates?.length === 0 && <p>{copy('budgetEmpty')}</p>}
                {candidates?.map((item) => <ExpenseProposal key={item.key} item={item} month={format(month, 'yyyy-MM')} />)}
            </div>
        </Modal>
    );
}
