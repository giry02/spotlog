import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccountContext, type AccountView, type AccountEntry } from './accountContext';
import { AccountSheet } from './AccountSheet';
import { createSocialAccountAdapter, type SocialAccountAdapter, type SocialSession } from './socialAccountService';
import { createReviewAccountAdapter } from './reviewAccountService';
import { ACCOUNT_EXPIRED_EVENT } from './serviceRequest';
import { errorKindForFailure, type ErrorKind } from './errorStates';
import { selectAccountAdapterMode } from './accountEntry';

const endpoint = import.meta.env.VITE_ACCOUNT_ENDPOINT ?? '';
// Public static previews opt in explicitly; a configured service always wins,
// including when its requests fail. An ordinary production build stays disabled.
// Keep the compile-time gate outside the helper so ordinary production bundles
// can remove the review adapter and its public credentials entirely.
const defaultAdapter = (import.meta.env.DEV || import.meta.env.VITE_ACCOUNT_REVIEW_MODE === '1') && selectAccountAdapterMode({ endpoint, development: import.meta.env.DEV, reviewMode: import.meta.env.VITE_ACCOUNT_REVIEW_MODE }) === 'REVIEW' ? createReviewAccountAdapter() : createSocialAccountAdapter(endpoint);
export function AccountProvider({ children, adapter = defaultAdapter }: { children: ReactNode; adapter?: SocialAccountAdapter }) {
  const [session, setSession] = useState<SocialSession>({ state: 'GUEST' });
  const [status, setStatus] = useState<'CHECKING' | 'READY' | 'ERROR'>(adapter.configured ? 'CHECKING' : 'READY');
  const [sheet, setSheet] = useState<{ view: AccountView; reason?: string; entry?: AccountEntry; instance: number } | null>(null);
  const sheetInstance = useRef(0);
  const [generation, setGeneration] = useState(0);
  const [failureKind, setFailureKind] = useState<ErrorKind | null>(null);
  const request = useRef<AbortController | null>(null);
  const updateSession = useCallback((next: SocialSession) => { request.current?.abort(); setSession(next); setStatus('READY'); setFailureKind(null); }, []);
  useEffect(() => { const expired = () => { if (adapter.reviewAccount) void adapter.signOut(new AbortController().signal).catch(() => {}); updateSession({ state: 'GUEST' }); }; window.addEventListener(ACCOUNT_EXPIRED_EVENT, expired); return () => window.removeEventListener(ACCOUNT_EXPIRED_EVENT, expired); }, [updateSession, adapter]);
  useEffect(() => {
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    if (!adapter.configured) { setSession({ state: 'GUEST' }); setStatus('READY'); setFailureKind(null); return () => controller.abort(); }
    setStatus('CHECKING'); setFailureKind(null);
    void adapter.session(controller.signal).then(next => { if (!controller.signal.aborted) { setSession(next); setStatus('READY'); if (next.state === 'PENDING_SIGNUP') setSheet(current => current ?? { view: 'signup', instance: ++sheetInstance.current }); else if (next.state === 'SIGNED_IN') setSheet(current => current?.view === 'manage' ? current : null); } }).catch(error => { if (!controller.signal.aborted) { setSession({ state: 'GUEST' }); setFailureKind(errorKindForFailure(error)); setStatus('ERROR'); } });
    return () => controller.abort();
  }, [adapter, generation]);
  useEffect(() => {
    if (!adapter.configured) return;
    let lastCheck = Date.now();
    const recheck = () => { if (document.visibilityState !== 'hidden' && Date.now() - lastCheck > 30000) { lastCheck = Date.now(); setGeneration(g => g + 1); } };
    window.addEventListener('focus', recheck); document.addEventListener('visibilitychange', recheck);
    return () => { window.removeEventListener('focus', recheck); document.removeEventListener('visibilitychange', recheck); };
  }, [adapter]);
  const openAccount = (view: AccountView = session.state === 'SIGNED_IN' ? 'manage' : 'login', reason?: string, entry?: AccountEntry) => setSheet({ view, reason, entry, instance: ++sheetInstance.current });
  const sessionIdentity = session.state === 'SIGNED_IN' ? 'member:' + session.user.id : session.state === 'PENDING_SIGNUP' ? 'signup:' + session.provider : 'guest';
  return <AccountContext.Provider value={{ adapter, session, status, failureKind, updateSession, refresh: () => setGeneration(g => g + 1), openAccount, requireMember: reason => {
    if (status === 'READY' && session.state === 'SIGNED_IN') return true;
    openAccount('login', reason); return false;
  } }}>{children}{sheet && <AccountSheet key={sheet.instance + ':' + sessionIdentity} adapter={adapter} initialView={sheet.view} initialEntry={sheet.entry} reason={sheet.reason} onClose={() => setSheet(null)} />}</AccountContext.Provider>;
}
