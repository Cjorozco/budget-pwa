import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useTourStore } from '@/store/tour';
import { useTranslation } from '@/lib/i18n';

type TourStepId =
    | 'welcome'
    | 'balance'
    | 'transactions'
    | 'newTransaction'
    | 'monthNavigator'
    | 'filters'
    | 'accounts'
    | 'newAccount'
    | 'reconcile'
    | 'reserve'
    | 'budget'
    | 'reports'
    | 'settings';

interface TourStep {
    id: TourStepId;
    /** Value of the `data-tour` attribute to spotlight; no target = centered card. */
    target?: string;
    /** Page the step lives on; the tour navigates there when it differs from the current one. */
    route: string;
}

const STEPS: TourStep[] = [
    { id: 'welcome', route: '/' },
    { id: 'balance', target: 'balance', route: '/' },
    { id: 'transactions', target: 'nav-transactions', route: '/' },
    { id: 'newTransaction', target: 'new-transaction', route: '/transactions' },
    { id: 'monthNavigator', target: 'month-navigator', route: '/transactions' },
    { id: 'filters', target: 'transaction-filters', route: '/transactions' },
    { id: 'accounts', target: 'nav-accounts', route: '/transactions' },
    { id: 'newAccount', target: 'new-account', route: '/accounts' },
    { id: 'reconcile', target: 'account-reconcile', route: '/accounts' },
    { id: 'reserve', target: 'account-reserve', route: '/accounts' },
    { id: 'budget', target: 'nav-budget', route: '/accounts' },
    { id: 'reports', target: 'nav-reports', route: '/accounts' },
    { id: 'settings', target: 'nav-settings', route: '/accounts' },
];

const AUTO_START_DELAY_MS = 600;
const SPOTLIGHT_PADDING = 6;
const CARD_GAP = 12;
/** A freshly navigated page needs a moment to mount its targets. */
const MEASURE_RETRY_MS = 50;
const MEASURE_MAX_TRIES = 10;

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

function measure(target?: string): Rect | null {
    if (!target) return null;
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Guided tour: spotlights key parts of the app one at a time.
 * Auto-opens once for new users on the dashboard; replayable from Settings.
 */
export function AppTour() {
    const { pathname } = useLocation();
    const isOpen = useTourStore((s) => s.isOpen);
    const isDone = useTourStore((s) => s.isDone);
    const start = useTourStore((s) => s.start);

    // Auto-open once, only from the dashboard, after the first paint settles.
    useEffect(() => {
        if (isDone || isOpen || pathname !== '/') return;
        const id = window.setTimeout(start, AUTO_START_DELAY_MS);
        return () => window.clearTimeout(id);
    }, [isDone, isOpen, pathname, start]);

    return isOpen ? <TourSteps /> : null;
}

/** Mounted only while the tour is open, so every run starts at step 1. A missing target degrades to a centered card. */
function TourSteps() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const finish = useTourStore((s) => s.finish);

    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const nextRef = useRef<HTMLButtonElement | null>(null);

    const step = STEPS[stepIndex];
    const isLast = stepIndex === STEPS.length - 1;

    useEffect(() => {
        if (pathname !== step.route) navigate(step.route);
    }, [pathname, step.route, navigate]);

    const update = useCallback(() => setRect(measure(step.target)), [step.target]);

    useEffect(() => {
        // scrollIntoView is missing in some environments (jsdom), hence the optional call.
        let tries = 0;
        let timer = 0;
        const locate = () => {
            const el = document.querySelector(`[data-tour="${step.target}"]`);
            if (el || !step.target || ++tries >= MEASURE_MAX_TRIES) {
                el?.scrollIntoView?.({ block: 'center' });
                update();
                return;
            }
            timer = window.setTimeout(locate, MEASURE_RETRY_MS);
        };
        timer = window.setTimeout(locate, 0);
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [step.target, pathname, update]);

    useEffect(() => {
        nextRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') finish();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [stepIndex, finish]);

    const copy = t.tour.steps[step.id];
    const spotlight = rect && {
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
    };

    // Card goes above the target when it sits in the lower half of the screen (bottom nav), else below.
    const placeAbove = spotlight ? spotlight.top + spotlight.height / 2 > window.innerHeight / 2 : false;
    const cardStyle: React.CSSProperties = spotlight
        ? placeAbove
            ? { bottom: window.innerHeight - spotlight.top + CARD_GAP }
            : { top: spotlight.top + spotlight.height + CARD_GAP }
        : { top: '50%', transform: 'translateY(-50%)' };

    return (
        <div className="fixed inset-0 z-[80]" data-testid="app-tour">
            {spotlight ? (
                <div
                    aria-hidden="true"
                    className="absolute rounded-2xl ring-2 ring-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.7)] transition-all duration-300 pointer-events-none"
                    style={spotlight}
                />
            ) : (
                <div aria-hidden="true" className="absolute inset-0 bg-slate-900/70" />
            )}

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="tour-title"
                aria-describedby="tour-desc"
                className="absolute left-4 right-4 mx-auto max-w-sm p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3"
                style={cardStyle}
            >
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {t.tour.progress.replace('{current}', String(stepIndex + 1)).replace('{total}', String(STEPS.length))}
                </p>
                <h2 id="tour-title" className="text-lg font-bold text-slate-900 dark:text-white">
                    {copy.title}
                </h2>
                <p id="tour-desc" className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {copy.description}
                </p>

                <div className="flex items-center justify-between gap-2 pt-1">
                    {isLast ? <span /> : (
                        <Button type="button" variant="ghost" onClick={finish}>
                            {t.tour.skip}
                        </Button>
                    )}
                    <div className="flex gap-2">
                        {stepIndex > 0 && (
                            <Button type="button" variant="outline" onClick={() => setStepIndex((i) => i - 1)}>
                                {t.tour.back}
                            </Button>
                        )}
                        <Button
                            ref={nextRef}
                            type="button"
                            onClick={isLast ? finish : () => setStepIndex((i) => i + 1)}
                        >
                            {isLast ? t.tour.finish : t.tour.next}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
