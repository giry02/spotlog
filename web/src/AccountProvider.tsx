import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccountContext, type AccountView } from './accountContext';
import { AccountSheet } from './AccountSheet';
import { createSocialAccountAdapter, type SocialAccountAdapter, type SocialSession } from './socialAccountService';
import { createReviewAccountAdapter } from './reviewAccountService';
import { ACCOUNT_EXPIRED_EVENT } from './serviceRequest';
import { errorKindForFailure, type ErrorKind } from './errorStates';

const endpoint = import.meta.env.VITE_ACCOUNT_ENDPOINT ?? '';
const defaultAdapter = import.meta.env.DEV && !endpoint ? createReviewAccountAdapter() : createSocialAccountAdapter(endpoint);
export function AccountProvider({ children, adapter = defaultAdapter }: { children: ReactNode; adapter?: SocialAccountAdapter }) {
  const [session, setSession] = useState<SocialSession>({ state: 'GUEST' });
  const [status, setStatus] = useState<'CHECKING' | 'READY' | 'ERROR'>(adapter.configured ? 'CHECKING' : 'READY');
  const [sheet, setSheet] = useState<{ view: AccountView; reason?: string } | null>(null);
  const [generation, setGeneration] = useState(0);
  const [failureKind, setFailureKind] = useState<ErrorKind | null>(null);
  const request = useRef<AbortController | null>(null);
  const updateSession = useCallback((next: SocialSession) => { request.current?.abort(); setSession(next); setStatus('READY'); setFailureKind(null); }, []);
  useEffect(() => { const expired = () => { if (adapter.reviewAccount) void adapter.signOut(new AbortController().signal).catch(() => {}); updateSession({ state: 'GUEST' }); }; window.addEventListener(ACCOUNT_EXPIRED_EVENT, expired); return () => window.removeEventListener(ACCOUNT_EXPIRED_EVENT, expired); }, [updateSession, adapter]);
  useEffect(() => {
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    if (!adapter.configured) { setSession({ state: 'GUEST' }); setStatus('READY'); setFailureKind(null); return () => controller.abort(); }
    setStatus('CHECKING'); setFailureKind(null);
    void adapter.session(controller.signal).then(next => { if (!controller.signal.aborted) { setSession(next); setStatus('READY'); if (next.state === 'PENDING_SIGNUP') setSheet({ view: 'signup' }); } }).catch(error => { if (!controller.signal.aborted) { setSession({ state: 'GUEST' }); setFailureKind(errorKindForFailure(error)); setStatus('ERROR'); } });
    return () => controller.abort();
  }, [adapter, generation]);
  useEffect(() => {
    if (!adapter.configured) return;
    let lastCheck = Date.now();
    const recheck = () => { if (document.visibilityState !== 'hidden' && Date.now() - lastCheck > 30000) { lastCheck = Date.now(); setGeneration(g => g + 1); } };
    window.addEventListener('focus', recheck); document.addEventListener('visibilitychange', recheck);
    return () => { window.removeEventListener('focus', recheck); document.removeEventListener('visibilitychange', recheck); };
  }, [adapter]);
  const openAccount = (view: AccountView = 'login', reason?: string) => setSheet({ view, reason });
  return <AccountContext.Provider value={{ adapter, session, status, failureKind, updateSession, refresh: () => setGeneration(g => g + 1), openAccount, requireMember: reason => {
    if (status === 'READY' && session.state === 'SIGNED_IN') return true;
    openAccount('login', reason); return false;
  } }}>{children}{sheet && <AccountSheet adapter={adapter} initialView={sheet.view} reason={sheet.reason} onClose={() => setSheet(null)} />}</AccountContext.Provider>;
}
