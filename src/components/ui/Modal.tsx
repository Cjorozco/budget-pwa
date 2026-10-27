import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    const { t } = useTranslation();
    const titleId = useId();
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    // Keep a stable ref so Esc works without re-running this effect on every parent render
    // (inline onClose callbacks would otherwise steal focus back to the close button).
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab' || !dialogRef.current) return;
            const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        };
        const previouslyFocused = document.activeElement as HTMLElement | null;
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEsc);
            // Focus close only when the dialog opens — not on every parent re-render.
            closeButtonRef.current?.focus();
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
            if (isOpen && previouslyFocused?.isConnected) previouslyFocused.focus();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                "relative w-full max-w-lg transform rounded-2xl bg-white dark:bg-slate-900 shadow-xl transition-all flex flex-col max-h-[min(90dvh,calc(100dvh-2rem))]",
                "duration-200"
                )}
            >
                <div className="flex items-center justify-between p-6 pb-2">
                    <h2
                        id={titleId}
                        className="text-xl font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100"
                    >
                        {title}
                    </h2>
                    <Button
                        ref={closeButtonRef}
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        aria-label={t.common.close}
                        className="h-11 w-11 rounded-full"
                    >
                        <X size={18} />
                    </Button>
                </div>

                <div className="p-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto overflow-x-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}
