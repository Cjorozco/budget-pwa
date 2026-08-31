import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) {
  void import('./lib/db/seedDemoMarketing').then(({ seedDemoMarketing }) => {
    (window as unknown as { __seedBudgetDemo?: typeof seedDemoMarketing }).__seedBudgetDemo =
      seedDemoMarketing;
    console.info('[demo] localhost: window.__seedBudgetDemo() siembra datos ficticios de marketing.');
  });
}
