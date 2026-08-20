import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    const titleId = useId();
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    // Keep a stable ref so Esc works without re-running this effect on every parent render
    // (inline onClose callbacks would otherwise steal focus back to the close button).
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCloseRef.current();
        };
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
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                "relative w-full max-w-lg transform rounded-2xl bg-white dark:bg-slate-900 shadow-xl transition-all flex flex-col max-h-[90vh]",
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
                        className="h-8 w-8 rounded-full"
                    >
                        <X size={18} />
                    </Button>
                </div>

                <div className="p-6 pt-2 overflow-y-auto overflow-x-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}
