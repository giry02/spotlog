import { createRoot } from 'react-dom/client';
import App from '../src/App';
import { createSocialAccountAdapter } from '../src/socialAccountService';
import { makeAdminSeed } from '../src/admin/seed';
import '../src/styles.css';
import '../src/theme.css';

// This entry is DEV-only and never selected by the production build. The real
// HTTP adapter is exercised; an isolated browser test provides fake responses.
// It contains no member credentials, OAuth tokens or signed-in local state.
if (import.meta.env.DEV) {
  if (!localStorage.getItem('spotlog.admin.review.v1')) localStorage.setItem('spotlog.admin.review.v1', JSON.stringify(makeAdminSeed()));
  const params = new URLSearchParams(window.location.search);
  const adapter = createSocialAccountAdapter(params.has('unconfigured') ? '' : '/api/qa-account-methods');
  createRoot(document.getElementById('root')!).render(<App accountAdapter={adapter} />);
}
