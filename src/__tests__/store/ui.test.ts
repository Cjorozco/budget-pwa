import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUIStore } from '@/store/ui';

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useUIStore.setState({
      isSidebarOpen: false,
      toasts: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sidebar', () => {
    it('starts with sidebar closed', () => {
      const state = useUIStore.getState();
      expect(state.isSidebarOpen).toBe(false);
    });

    it('toggles sidebar open', () => {
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().isSidebarOpen).toBe(true);
    });

    it('toggles sidebar closed after opening', () => {
      useUIStore.getState().toggleSidebar(); // open
      useUIStore.getState().toggleSidebar(); // close
      expect(useUIStore.getState().isSidebarOpen).toBe(false);
    });
  });

  describe('toasts', () => {
    it('starts with no toasts', () => {
      expect(useUIStore.getState().toasts).toHaveLength(0);
    });

    it('adds a toast with default type "info"', () => {
      useUIStore.getState().addToast('Test message');
      const toasts = useUIStore.getState().toasts;

      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe('info');
      expect(toasts[0].id).toBeDefined();
    });

    it('adds a toast with explicit type', () => {
      useUIStore.getState().addToast('Success!', 'success');
      const toasts = useUIStore.getState().toasts;

      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('success');
    });

    it('adds multiple toasts', () => {
      useUIStore.getState().addToast('First');
      useUIStore.getState().addToast('Second', 'error');

      expect(useUIStore.getState().toasts).toHaveLength(2);
    });

    it('removes toast by id', () => {
      useUIStore.getState().addToast('To remove');
      const toastId = useUIStore.getState().toasts[0].id;

      useUIStore.getState().removeToast(toastId);
      expect(useUIStore.getState().toasts).toHaveLength(0);
    });

    it('only removes the specified toast', () => {
      useUIStore.getState().addToast('Keep me');
      useUIStore.getState().addToast('Remove me');
      const toasts = useUIStore.getState().toasts;
      const removeId = toasts[1].id;

      useUIStore.getState().removeToast(removeId);

      const remaining = useUIStore.getState().toasts;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].message).toBe('Keep me');
    });

    it('auto-removes toast after 3 seconds', () => {
      vi.useFakeTimers();

      useUIStore.getState().addToast('Auto remove');
      expect(useUIStore.getState().toasts).toHaveLength(1);

      // Advance time by 3 seconds
      vi.advanceTimersByTime(3000);

      expect(useUIStore.getState().toasts).toHaveLength(0);

      vi.useRealTimers();
    });

    it('does not remove toast before 3 seconds', () => {
      vi.useFakeTimers();

      useUIStore.getState().addToast('Still here');
      vi.advanceTimersByTime(2999);

      expect(useUIStore.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(1); // Now at 3000ms
      expect(useUIStore.getState().toasts).toHaveLength(0);

      vi.useRealTimers();
    });

    it('generates unique ids for each toast', () => {
      useUIStore.getState().addToast('First');
      useUIStore.getState().addToast('Second');

      const toasts = useUIStore.getState().toasts;
      expect(toasts[0].id).not.toBe(toasts[1].id);
    });
  });
});
