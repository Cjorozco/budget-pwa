import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

function ensureLocalStorage(): void {
    try {
        if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
            localStorage.setItem('__budget_ls_probe', '1');
            localStorage.removeItem('__budget_ls_probe');
            return;
        }
    } catch {
        // Node workers: localStorage exists as a stub without storage
    }

    const store = new Map<string, string>();
    const memoryStorage: Storage = {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (key) => store.get(key) ?? null,
        key: (index) => Array.from(store.keys())[index] ?? null,
        removeItem: (key) => {
            store.delete(key);
        },
        setItem: (key, value) => {
            store.set(key, String(value));
        },
    };
    Object.defineProperty(globalThis, 'localStorage', {
        value: memoryStorage,
        configurable: true,
    });
}

ensureLocalStorage();

afterEach(() => {
    cleanup();
});
