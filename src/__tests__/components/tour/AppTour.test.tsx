import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppTour } from '@/components/tour/AppTour';
import { TOUR_DONE_KEY, useTourStore } from '@/store/tour';

function Path() {
    return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderTour(path = '/') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <nav>
                <a href="/transactions" data-tour="nav-transactions">Movimientos</a>
            </nav>
            <Path />
            <AppTour />
        </MemoryRouter>,
    );
}

describe('AppTour', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        useTourStore.setState({ isOpen: false, isDone: false });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('auto-opens once for new users on the dashboard', () => {
        renderTour();
        expect(screen.queryByTestId('app-tour')).toBeNull();
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Paso 1 de 13')).toBeInTheDocument();
    });

    it('does not auto-open outside the dashboard or after it was completed', () => {
        renderTour('/settings');
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.queryByTestId('app-tour')).toBeNull();

        useTourStore.setState({ isDone: true });
        renderTour('/');
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.queryByTestId('app-tour')).toBeNull();
    });

    it('navigates with next/back and degrades to a centered card when the target is missing', () => {
        useTourStore.setState({ isOpen: true });
        renderTour();
        fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(screen.getByText('Paso 2 de 13')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
        expect(screen.getByText('Paso 1 de 13')).toBeInTheDocument();
    });

    it('remembers skipping so it never auto-opens again', () => {
        useTourStore.setState({ isOpen: true });
        renderTour();
        fireEvent.click(screen.getByRole('button', { name: 'Omitir' }));
        expect(screen.queryByTestId('app-tour')).toBeNull();
        expect(localStorage.getItem(TOUR_DONE_KEY)).toBe('1');
    });

    it('finishes on the last step and restarts at step 1 when replayed', () => {
        useTourStore.setState({ isOpen: true });
        renderTour();
        for (let i = 0; i < 12; i++) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(screen.getByText('Paso 13 de 13')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '¡Listo!' }));
        expect(screen.queryByTestId('app-tour')).toBeNull();

        act(() => useTourStore.getState().start());
        expect(screen.getByText('Paso 1 de 13')).toBeInTheDocument();
    });

    it('closes with Escape', () => {
        useTourStore.setState({ isOpen: true });
        renderTour();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByTestId('app-tour')).toBeNull();
    });

    it('navigates to Movimientos for its steps and back to the dashboard on Atrás', () => {
        useTourStore.setState({ isOpen: true });
        renderTour();
        for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(screen.getByText('Paso 4 de 13')).toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent('/transactions');
        fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
        expect(screen.getByTestId('path')).toHaveTextContent('/');
        expect(screen.getByTestId('path').textContent).not.toBe('/transactions');
    });

    it('moves on to Cuentas for its steps', () => {
        useTourStore.setState({ isOpen: true });
        renderTour();
        for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(screen.getByText('Paso 8 de 13')).toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent('/accounts');
    });
});
