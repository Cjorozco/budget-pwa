import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sparkles } from 'lucide-react';
import { db } from '@/lib/db';
import { hasDemoData, seedDemoData } from '@/lib/db/demoMode';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/ui';
import { useTranslation } from '@/lib/i18n';

const DISMISS_KEY = 'budget_onboarding_dismissed';

function readDismissed(): boolean {
    try {
        return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
        return false;
    }
}

/** First-use choice shown on the dashboard while there is no activity at all. */
export function DemoEmptyState() {
    const { t, language } = useTranslation();
    const addToast = useUIStore((s) => s.addToast);
    const [dismissed, setDismissed] = useState(readDismissed);
    const [isLoading, setIsLoading] = useState(false);

    // undefined while loading, so the card never flashes for returning users.
    const isEmpty = useLiveQuery(async () => {
        const [txCount, demo] = await Promise.all([db.transactions.count(), hasDemoData()]);
        return txCount === 0 && !demo;
    });

    if (dismissed || !isEmpty) return null;

    const startFresh = () => {
        try {
            localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // Storage unavailable: the card just reappears next visit.
        }
        setDismissed(true);
    };

    const explore = async () => {
        setIsLoading(true);
        try {
            await seedDemoData(language);
            addToast(t.demo.seedSuccess, 'success');
        } catch (error) {
            console.error(error);
            addToast(t.demo.seedError, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section
            className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 space-y-4"
            data-testid="demo-empty-state"
        >
            <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0">
                    <Sparkles size={20} />
                </div>
                <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">{t.demo.emptyTitle}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{t.demo.emptyDescription}</p>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <Button type="button" onClick={explore} isLoading={isLoading} className="w-full">
                    {isLoading ? t.demo.loadingDemo : t.demo.exploreDemo}
                </Button>
                <Button type="button" variant="outline" onClick={startFresh} disabled={isLoading} className="w-full">
                    {t.demo.startFresh}
                </Button>
            </div>
        </section>
    );
}
