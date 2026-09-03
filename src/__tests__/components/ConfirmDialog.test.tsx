import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useUIStore } from '@/store/ui';

describe('ConfirmDialog component', () => {
    beforeEach(() => {
        useUIStore.setState({ confirmDialog: null });
    });

    it('renders nothing when there is no active confirm dialog', () => {
        const { container } = render(<ConfirmDialog />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders alertdialog with accessible title, message and custom labels', () => {
        useUIStore.setState({
            confirmDialog: {
                title: '¿Deseas continuar?',
                message: 'Esto aplicará cambios permanentes.',
                confirmLabel: 'Sí, aplicar',
                cancelLabel: 'No, cancelar',
                variant: 'primary',
                resolve: () => {},
            },
        });

        render(<ConfirmDialog />);

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(screen.getByText('¿Deseas continuar?')).toBeInTheDocument();
        expect(screen.getByText('Esto aplicará cambios permanentes.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sí, aplicar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'No, cancelar' })).toBeInTheDocument();
    });

    it('resolves true when clicking confirm button', async () => {
        const user = userEvent.setup();
        let resolvedValue: boolean | null = null;

        useUIStore.setState({
            confirmDialog: {
                title: 'Eliminar elemento',
                message: 'No se puede deshacer.',
                variant: 'danger',
                resolve: (val) => {
                    resolvedValue = val;
                },
            },
        });

        render(<ConfirmDialog />);

        const confirmBtn = screen.getByRole('button', { name: 'Eliminar' });
        await user.click(confirmBtn);

        expect(resolvedValue).toBe(true);
        expect(useUIStore.getState().confirmDialog).toBeNull();
    });

    it('resolves false when clicking cancel button', async () => {
        const user = userEvent.setup();
        let resolvedValue: boolean | null = null;

        useUIStore.setState({
            confirmDialog: {
                title: 'Eliminar elemento',
                message: 'No se puede deshacer.',
                variant: 'danger',
                resolve: (val) => {
                    resolvedValue = val;
                },
            },
        });

        render(<ConfirmDialog />);

        const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
        await user.click(cancelBtn);

        expect(resolvedValue).toBe(false);
        expect(useUIStore.getState().confirmDialog).toBeNull();
    });

    it('resolves false when pressing Escape key', async () => {
        const user = userEvent.setup();
        let resolvedValue: boolean | null = null;

        useUIStore.setState({
            confirmDialog: {
                title: 'Acción importante',
                message: 'Detalle de la acción',
                resolve: (val) => {
                    resolvedValue = val;
                },
            },
        });

        render(<ConfirmDialog />);

        await user.keyboard('{Escape}');

        expect(resolvedValue).toBe(false);
        expect(useUIStore.getState().confirmDialog).toBeNull();
    });
});
