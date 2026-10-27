import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
// Secondary screens load on demand to keep the first bundle small.
const TransactionsPage = lazy(() => import('@/pages/Transactions'));
const AccountsPage = lazy(() => import('@/pages/Accounts'));
const CategoriesPage = lazy(() => import('@/pages/Categories'));
const BudgetPage = lazy(() => import('@/pages/Budget'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const AmbiguousReview = lazy(() => import('@/pages/AmbiguousReview'));
const TemplatesPage = lazy(() => import('@/pages/Templates'));
const ReportsPage = lazy(() => import('@/pages/Reports'));
import { seedInitialData } from '@/lib/db/seed';
import { InstallPWA } from '@/components/InstallPWA';
import { Toaster } from '@/components/Toaster';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpgradeModal } from '@/components/ui/UpgradeModal';
import { useRegionStore } from '@/lib/region/regionStore';
import { startLicenseLifecycle } from '@/store/licenseStore';


function App() {
  // formatCurrency() reads the active region directly, so changing it remounts the screens.
  const country = useRegionStore((state) => state.country);

  useEffect(() => {
    // Run seeder on mount
    seedInitialData().catch(console.error);
    // Verify the stored license with Lemon Squeezy (throttled, offline-tolerant)
    startLicenseLifecycle();
  }, []);

  return (
    // reducedMotion="user": with prefers-reduced-motion, motion keeps fades but drops movement.
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ErrorBoundary key={country}>
          <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="budget" element={<BudgetPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="review" element={<AmbiguousReview />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>
          </Routes>
          </Suspense>
        </ErrorBoundary>
        <InstallPWA />
        <Toaster />
        <ConfirmDialog />
        <UpgradeModal />
      </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
