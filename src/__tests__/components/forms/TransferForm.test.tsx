import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferForm } from '@/components/forms/TransferForm';
import { db } from '@/lib/db';

describe('TransferForm', () => {
    const onSuccess = vi.fn();

    beforeEach(async () => {
        vi.clearAllMocks();
        await db.accounts.clear();
        await db.transactions.clear();
        await db.accounts.bulkAdd([
            { id: 'src', name: 'Origen', type: 'bank', calculatedBalance: 100000, actualBalance: 100000, currency: 'COP', isActive: true },
            { id: 'dst', name: 'Destino', type: 'bank', calculatedBalance: 50000, actualBalance: 50000, currency: 'COP', isActive: true },
        ]);
    });

    it('moves money between accounts without changing the total (calculated and actual)', async () => {
        const user = userEvent.setup();
        const { container } = render(<TransferForm onSuccess={onSuccess} onCancel={vi.fn()} />);

        await screen.findAllByRole('option', { name: 'Origen' });
        const [fromSelect, toSelect] = Array.from(container.querySelectorAll('select'));
        await user.selectOptions(fromSelect, 'src');
        await user.selectOptions(toSelect, 'dst');
        await user.type(container.querySelector('input[type="number"]')!, '30000');
        await user.click(container.querySelector('button[type="submit"]')!);

        await waitFor(() => expect(onSuccess).toHaveBeenCalled());

        const src = await db.accounts.get('src');
        const dst = await db.accounts.get('dst');
        expect(src?.calculatedBalance).toBe(70000);
        expect(src?.actualBalance).toBe(70000);
        expect(dst?.calculatedBalance).toBe(80000);
        expect(dst?.actualBalance).toBe(80000);
    });
});
