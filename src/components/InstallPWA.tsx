import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/Button';

export function InstallPWA() {
    const [promptInstall, setPromptInstall] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setPromptInstall(e);

            // Show only if not already installed and haven't dismissed it in this session
            const isDismissed = sessionStorage.getItem('pwa-install-dismissed');
            if (!isDismissed) {
                setIsVisible(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const onClickInstall = async () => {
        if (!promptInstall) return;
        promptInstall.prompt();
        const { outcome } = await promptInstall.userChoice;
        if (outcome === 'accepted') {
            setIsVisible(false);
        }
    };

    const onDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('pwa-install-dismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                        <Download className="text-blue-600 dark:text-blue-400" size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Instalar App</p>
                        <p className="text-[11px] text-slate-500">Acceso rápido y mejor experiencia</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={onClickInstall} className="text-xs h-8 px-3">
                        Instalar
                    </Button>
                    <button
                        onClick={onDismiss}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
