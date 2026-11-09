import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { downloadTextFile } from '@/lib/db/backup';
import { getDateFnsLocale, useTranslation } from '@/lib/i18n';
import { getHistoryFileName, loadMonthlyHistory, type HistoryRange } from '@/lib/reports/monthlyHistory';
import { toHistoryJson, toHistoryMarkdown } from '@/lib/reports/monthlyHistoryFormat';
import { formatCurrency } from '@/lib/utils';
import { useUIStore } from '@/store/ui';

interface ExportHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedMonth: Date;
}

export function ExportHistoryModal({ isOpen, onClose, selectedMonth }: ExportHistoryModalProps) {
    const { t, language } = useTranslation();
    const texts = t.reports.historyExport;
    const dateLocale = getDateFnsLocale(language);
    const addToast = useUIStore((state) => state.addToast);
    const [range, setRange] = useState<HistoryRange>('12');
    const monthKey = format(selectedMonth, 'yyyy-MM');

    const loaded = useLiveQuery(async () => {
        if (!isOpen) return null;
        const history = await loadMonthlyHistory({
            selectedMonth,
            range,
            labels: { uncategorized: t.transactions.uncategorized, parentFallback: t.reports.parentCategories },
        });
        return { history, range, monthKey };
    }, [isOpen, range, monthKey, language]);

    // useLiveQuery keeps the previous result while reloading: never export it for a different range.
    const history = loaded && loaded.range === range && loaded.monthKey === monthKey ? loaded.history : null;
    const hasData = history?.months.some((month) => month.hasData) ?? false;

    const handleDownload = (extension: 'json' | 'md') => {
        if (!history) return;
        try {
            if (extension === 'json') {
                downloadTextFile(toHistoryJson(history), getHistoryFileName(history, 'json'), 'application/json');
            } else {
                const markdown = toHistoryMarkdown(history, { labels: texts, formatMoney: formatCurrency, dateLocale });
                downloadTextFile(markdown, getHistoryFileName(history, 'md'), 'text/markdown;charset=utf-8');
            }
            addToast(texts.success, 'success');
        } catch {
            addToast(texts.error, 'error');
        }
    };

    const options: Array<{ value: HistoryRange; label: string }> = [
        { value: 'month', label: texts.rangeMonth },
        { value: '6', label: texts.range6 },
        { value: '12', label: texts.range12 },
        { value: 'all', label: texts.rangeAll },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={texts.modalTitle}>
            <div className="space-y-5">
                <fieldset>
                    <legend className="text-sm font-medium text-text">{texts.rangeLabel}</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {options.map((option) => (
                            <label
                                key={option.value}
                                className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-text-muted/30 px-3 text-sm font-medium text-text transition-colors hover:bg-surface-raised has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-on-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                            >
                                <input
                                    type="radio"
                                    name="history-range"
                                    value={option.value}
                                    checked={range === option.value}
                                    onChange={() => setRange(option.value)}
                                    className="sr-only"
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-text-muted">
                        {texts.rangeHint.replace('{month}', format(selectedMonth, 'MMMM yyyy', { locale: dateLocale }))}
                    </p>
                </fieldset>

                {history && !hasData && (
                    <p role="status" className="rounded-xl bg-surface-raised p-3 text-sm text-text">
                        {texts.noData}
                    </p>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button disabled={!hasData} onClick={() => handleDownload('json')}>
                        {texts.downloadJson}
                    </Button>
                    <Button variant="outline" disabled={!hasData} onClick={() => handleDownload('md')}>
                        {texts.downloadMarkdown}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
