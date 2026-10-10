import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegionSelector } from '@/components/settings/RegionSelector';
import { db } from '@/lib/db';
import { getRegion, useRegionStore } from '@/lib/region/regionStore';
import { useI18nStore } from '@/lib/i18n/i18nStore';
import { useUIStore } from '@/store/ui';

describe('RegionSelector', () => {
    const confirmMock = vi.fn();

    beforeEach(async () => {
        localStorage.clear();
        useRegionStore.setState({ country: 'CO' });
        useI18nStore.setState({ language: 'es' });
        confirmMock.mockReset();
        useUIStore.setState({ confirm: confirmMock, toasts: [] });
        await db.accounts.clear();
        await db.appConfig.clear();
        await db.appConfig.add({ id: 'singleton', defaultCurrency: 'COP', minConfidenceThreshold: 0.7, enableAISuggestions: true });
    });

    afterEach(() => {
        localStorage.clear();
    });

    const addAccount = () =>
        db.accounts.add({ id: 'a1', name: 'Banco', type: 'bank', calculatedBalance: 100, currency: 'COP', isActive: true });

    it('lists the three countries with their currency and marks the active one', () => {
        render(<RegionSelector />);

        expect(screen.getByTestId('region-select-CO')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('region-select-CA')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByTestId('region-select-CO')).toHaveTextContent('COP');
        expect(screen.getByTestId('region-select-CA')).toHaveTextContent('CAD');
        expect(screen.getByTestId('region-select-US')).toHaveTextContent('USD');
    });

    it('asks for confirmation when accounts exist, then relabels them and the app config', async () => {
        await addAccount();
        confirmMock.mockResolvedValue(true);
        render(<RegionSelector />);
        await waitFor(() => expect(db.accounts.count()).resolves.toBe(1));

        fireEvent.click(screen.getByTestId('region-select-CA'));

        await waitFor(() => expect(getRegion().country).toBe('CA'));
        expect(confirmMock).toHaveBeenCalledTimes(1);
        const message = confirmMock.mock.calls[0][0].message as string;
        expect(message).toContain('COP');
        expect(message).toContain('CAD');
        expect(message).toContain('1 cuenta');
        // amounts are relabeled, never converted
        expect(await db.accounts.get('a1')).toMatchObject({ currency: 'CAD', calculatedBalance: 100 });
        expect(await db.appConfig.get('singleton')).toMatchObject({ defaultCurrency: 'CAD', country: 'CA' });
        expect(useUIStore.getState().toasts.some((t) => t.message.includes('CAD'))).toBe(true);
    });

    it('changes nothing when the user cancels', async () => {
        await addAccount();
        confirmMock.mockResolvedValue(false);
        render(<RegionSelector />);
        await waitFor(() => expect(db.accounts.count()).resolves.toBe(1));

        fireEvent.click(screen.getByTestId('region-select-US'));

        await waitFor(() => expect(confirmMock).toHaveBeenCalled());
        expect(getRegion().country).toBe('CO');
        expect((await db.accounts.get('a1'))?.currency).toBe('COP');
        expect((await db.appConfig.get('singleton'))?.defaultCurrency).toBe('COP');
    });

    it('does not ask anything when there are no accounts to relabel', async () => {
        render(<RegionSelector />);

        fireEvent.click(screen.getByTestId('region-select-US'));

        await waitFor(() => expect(getRegion().country).toBe('US'));
        expect(confirmMock).not.toHaveBeenCalled();
        expect((await db.appConfig.get('singleton'))?.defaultCurrency).toBe('USD');
    });

    it('does nothing when the active country is clicked again', async () => {
        await addAccount();
        render(<RegionSelector />);

        fireEvent.click(screen.getByTestId('region-select-CO'));

        expect(confirmMock).not.toHaveBeenCalled();
        expect(getRegion().country).toBe('CO');
    });

    it('is localized', () => {
        useI18nStore.setState({ language: 'en' });
        render(<RegionSelector />);
        expect(screen.getByText('Region and currency')).toBeInTheDocument();
        expect(screen.getByTestId('region-select-CA')).toHaveTextContent('Canada');
    });
});
