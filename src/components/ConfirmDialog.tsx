import { useEffect, useId, useRef } from 'react';
import { useUIStore } from '@/store/ui';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ConfirmDialog() {
    const { confirmDialog, closeConfirmDialog } = useUIStore();
    const titleId = useId();
    const descId = useId();
    const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!confirmDialog) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeConfirmDialog(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        // Autofocus cancel button on dialog open for safety against accidental enters
        const timer = setTimeout(() => {
            cancelBtnRef.current?.focus();
        }, 30);

        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timer);
            document.body.style.overflow = 'unset';
        };
    }, [confirmDialog, closeConfirmDialog]);

    if (!confirmDialog) return null;

    const isDanger = confirmDialog.variant === 'danger';
    const confirmLabel = confirmDialog.confirmLabel || (isDanger ? 'Eliminar' : 'Confirmar');
    const cancelLabel = confirmDialog.cancelLabel || 'Cancelar';

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => closeConfirmDialog(false)}
                aria-hidden="true"
            />

            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
                className={cn(
                    "relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-slate-800 transition-all",
                    "duration-200 animate-in fade-in zoom-in-95"
                )}
            >
                <div className="flex items-start gap-4">
                    <div
                        className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                            isDanger
                                ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                                : "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                        )}
                    >
                        {isDanger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h2
                            id={titleId}
                            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                        >
                            {confirmDialog.title}
                        </h2>
                        <p
                            id={descId}
                            className="mt-2 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed"
                        >
                            {confirmDialog.message}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                    <Button
                        ref={cancelBtnRef}
                        variant="outline"
                        onClick={() => closeConfirmDialog(false)}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={isDanger ? 'destructive' : 'default'}
                        onClick={() => closeConfirmDialog(true)}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
