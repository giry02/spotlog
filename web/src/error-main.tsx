import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountProvider } from './AccountProvider';
import { useAccount } from './accountContext';
import { CustomerErrorBoundary } from './CustomerErrorBoundary';
import { LocaleProvider } from './locale';
import { ErrorPage } from './ErrorPage';
import { errorKindForType } from './errorStates';
import './styles.css';
import './theme.css';

function StandaloneError() {
  const account = useAccount()!;
  const kind = document.body.dataset.errorPage === 'missing' ? 404 : errorKindForType(new URLSearchParams(window.location.search).get('type'));
  const root = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  const home = () => window.location.assign(root + '#home');
  useEffect(() => { if (kind === 401 && account.session.state === 'SIGNED_IN') window.location.replace(root + '#profile'); }, [kind, root, account.session.state]);
  const back = () => {
    // Never send a direct error link to an unrelated site via history.back().
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer?.origin === window.location.origin && referrer.pathname !== window.location.pathname && window.history.length > 1) window.history.back();
    else home();
  };
  return <main className="app-shell detail-open"><section className="content"><ErrorPage kind={kind} onHome={home} onBack={back} onRetry={() => window.location.reload()} onLogin={() => account.openAccount('login')} /></section></main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><LocaleProvider><AccountProvider><CustomerErrorBoundary onHome={() => window.location.assign(new URL(import.meta.env.BASE_URL, window.location.origin).href + '#home')}><StandaloneError /></CustomerErrorBoundary></AccountProvider></LocaleProvider></StrictMode>);
