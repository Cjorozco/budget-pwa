import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Unhandled error caught by ErrorBoundary:', error, errorInfo);
    }

    public resetError = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback && this.state.error) {
                return this.props.fallback(this.state.error, this.resetError);
            }

            return (
                <div className="min-h-[50vh] flex items-center justify-center p-4">
                    <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white dark:border-red-950/40 dark:bg-slate-900 p-6 sm:p-8 shadow-xl text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 mb-4">
                            <AlertOctagon size={28} />
                        </div>

                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            Algo no salió como esperábamos
                        </h2>

                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Ocurrió un error inesperado en esta vista. Tus datos financieros locales siguen a salvo en tu dispositivo.
                        </p>

                        {this.state.error?.message && (
                            <details className="mt-4 text-left rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-400">
                                <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                                    Detalle técnico del error
                                </summary>
                                <p className="mt-2 font-mono whitespace-pre-wrap break-words">
                                    {this.state.error.message}
                                </p>
                            </details>
                        )}

                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    window.location.href = '/';
                                }}
                                className="w-full sm:w-auto"
                            >
                                <Home size={16} className="mr-2" />
                                Ir al inicio
                            </Button>
                            <Button
                                variant="default"
                                onClick={this.resetError}
                                className="w-full sm:w-auto"
                            >
                                <RotateCcw size={16} className="mr-2" />
                                Reintentar
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
