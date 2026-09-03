import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import TransactionsPage from '@/pages/Transactions';
import AccountsPage from '@/pages/Accounts';
import CategoriesPage from '@/pages/Categories';
import BudgetPage from '@/pages/Budget';
import SettingsPage from '@/pages/Settings';
import AmbiguousReview from '@/pages/AmbiguousReview';
import TemplatesPage from '@/pages/Templates';
import ReportsPage from '@/pages/Reports';
import { seedInitialData } from '@/lib/db/seed';
import { InstallPWA } from '@/components/InstallPWA';
import { Toaster } from '@/components/Toaster';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';


function App() {
  useEffect(() => {
    // Run seeder on mount
    seedInitialData().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
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
      </ErrorBoundary>
      <InstallPWA />
      <Toaster />
      <ConfirmDialog />
    </BrowserRouter>
  );
}

export default App;
