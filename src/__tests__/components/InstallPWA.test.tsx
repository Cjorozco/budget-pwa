import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { InstallPWA } from '@/components/InstallPWA';

function fireInstallPrompt() {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => {}, userChoice: new Promise(() => {}) });
    act(() => {
        window.dispatchEvent(event);
    });
}

describe('InstallPWA', () => {
    afterEach(() => sessionStorage.clear());

    it('shows the install card when the browser offers installation', () => {
        render(<InstallPWA />);
        expect(screen.queryByTestId('install-pwa')).toBeNull();
        fireInstallPrompt();
        expect(screen.getByTestId('install-pwa')).toBeInTheDocument();
    });

    it('still shows it when the event fired before the component mounted', () => {
        fireInstallPrompt();
        render(<InstallPWA />);
        expect(screen.getByTestId('install-pwa')).toBeInTheDocument();
    });

    it('hides on dismiss and stays hidden for the session', () => {
        fireInstallPrompt();
        const { unmount } = render(<InstallPWA />);
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(screen.queryByTestId('install-pwa')).toBeNull();
        unmount();
        render(<InstallPWA />);
        expect(screen.queryByTestId('install-pwa')).toBeNull();
    });

    it('hides after the app is installed', () => {
        fireInstallPrompt();
        render(<InstallPWA />);
        act(() => {
            window.dispatchEvent(new Event('appinstalled'));
        });
        expect(screen.queryByTestId('install-pwa')).toBeNull();
    });
});
