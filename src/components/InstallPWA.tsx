import { useState, useSyncExternalStore } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from './ui/Button';
import { useTranslation } from '@/lib/i18n';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';

// Captured at module load, not in an effect: the browser fires this event once,
// possibly before React mounts, and a late listener would never see it.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
        notify();
    });
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        notify();
    });
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

function isStandalone(): boolean {
    const nav = navigator as Navigator & { standalone?: boolean };
    return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** iOS Safari never fires beforeinstallprompt; installing is a manual Share-sheet step. */
function isIOS(): boolean {
    const ua = navigator.userAgent;
    return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function readDismissed(): boolean {
    try {
        return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
        return false;
    }
}

export function InstallPWA() {
    const { t } = useTranslation();
    const prompt = useSyncExternalStore(subscribe, () => deferredPrompt, () => null);
    const [dismissed, setDismissed] = useState(readDismissed);

    const showIOSHint = !prompt && isIOS();
    if (dismissed || isStandalone() || (!prompt && !showIOSHint)) return null;

    const onInstall = async () => {
        if (!prompt) return;
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
            deferredPrompt = null;
            notify();
        }
    };

    const onDismiss = () => {
        setDismissed(true);
        try {
            sessionStorage.setItem(DISMISS_KEY, 'true');
        } catch {
            // Storage unavailable: it simply shows again next load.
        }
    };

    return (
        <div
            className="fixed left-4 right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50"
            data-testid="install-pwa"
        >
            <div className="bg-blue-600 text-white rounded-2xl p-4 shadow-2xl ring-2 ring-blue-300/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-white/20 rounded-xl shrink-0 animate-pulse">
                        {showIOSHint ? <Share size={22} /> : <Download size={22} />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold">{t.install.title}</p>
                        <p className="text-xs text-blue-100">
                            {showIOSHint ? t.install.iosSteps : t.install.description}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {!showIOSHint && (
                        <Button
                            size="sm"
                            onClick={onInstall}
                            className="bg-white text-blue-700 hover:bg-blue-50 font-bold h-11 px-4"
                        >
                            {t.install.button}
                        </Button>
                    )}
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label={t.install.dismiss}
                        className="h-11 w-11 flex items-center justify-center rounded-lg text-blue-100 hover:bg-white/10"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
