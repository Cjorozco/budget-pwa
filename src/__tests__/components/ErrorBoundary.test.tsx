import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
        throw new Error('Simulated component crash');
    }
    return <div>Contenido funcionando correctamente</div>;
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        // Suppress console.error in tests for intentional thrown errors
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <ProblemChild shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Contenido funcionando correctamente')).toBeInTheDocument();
    });

    it('catches render error and displays fallback UI', () => {
        render(
            <ErrorBoundary>
                <ProblemChild shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Algo no salió como esperábamos')).toBeInTheDocument();
        expect(screen.getByText(/Tus datos financieros locales siguen a salvo/)).toBeInTheDocument();
        expect(screen.getByText('Simulated component crash')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Ir al inicio/i })).toBeInTheDocument();
    });

    it('allows retry via reset button', async () => {
        const user = userEvent.setup();
        let shouldThrow = true;

        function DynamicChild() {
            if (shouldThrow) {
                throw new Error('Initial crash');
            }
            return <div>Recuperado con éxito</div>;
        }

        render(
            <ErrorBoundary>
                <DynamicChild />
            </ErrorBoundary>
        );

        expect(screen.getByText('Algo no salió como esperábamos')).toBeInTheDocument();

        // Fix the underlying issue before retrying
        shouldThrow = false;

        const retryButton = screen.getByRole('button', { name: /Reintentar/i });
        await user.click(retryButton);

        expect(screen.getByText('Recuperado con éxito')).toBeInTheDocument();
    });

    it('supports a custom fallback function', () => {
        render(
            <ErrorBoundary fallback={(err) => <div>Custom error: {err.message}</div>}>
                <ProblemChild shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Custom error: Simulated component crash')).toBeInTheDocument();
    });
});
