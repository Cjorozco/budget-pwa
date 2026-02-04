import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import TransactionsPage from '@/pages/Transactions';
import AccountsPage from '@/pages/Accounts';
import CategoriesPage from '@/pages/Categories';
import SettingsPage from '@/pages/Settings';
import AmbiguousReview from '@/pages/AmbiguousReview';
import TemplatesPage from '@/pages/Templates';
import { seedInitialData } from '@/lib/db/seed';
import { InstallPWA } from '@/components/InstallPWA';
import { Toaster } from '@/components/Toaster';


function App() {
  useEffect(() => {
    // Run seeder on mount
    seedInitialData().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="review" element={<AmbiguousReview />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <InstallPWA />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
