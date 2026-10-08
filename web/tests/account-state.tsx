import { createRoot } from 'react-dom/client';
import App from '../src/App';
import { draftPolicies } from '../src/accountPolicies';
import { ServiceError } from '../src/serviceRequest';
import type { SocialAccountAdapter, SocialSession } from '../src/socialAccountService';
import '../src/styles.css';
import '../src/theme.css';

// DEV-only integration fixture: deterministic responses, no actual member or mail.
if (import.meta.env.DEV) {
  const query = new URLSearchParams(window.location.search), scenario = query.get('scenario');
  const callbackProvider = query.get('provider') === 'APPLE' ? 'APPLE' as const : query.get('provider') === 'GOOGLE' ? 'GOOGLE' as const : null;
  const user = { id: 'fixture-member', displayName: '인증된 검수 회원', email: 'qa@example.invalid', provider: 'EMAIL' as const };
  let session: SocialSession = scenario === 'signed' || scenario === 'expired' ? { state: 'SIGNED_IN', user } : { state: 'GUEST' };
  if (callbackProvider && scenario === 'social-existing') session = { state: 'SIGNED_IN', user: { ...user, provider: callbackProvider } };
  if (callbackProvider && scenario === 'social-new') session = { state: 'PENDING_SIGNUP', provider: callbackProvider };
  let failedSession = false, failedSignup = false;
  const wait = () => new Promise<void>(r => window.setTimeout(r, 100));
  const adapter: SocialAccountAdapter = {
    configured: true,
    async session() { await wait(); if (scenario === 'session-fail' && !failedSession) { failedSession = true; throw new ServiceError(503, 'fixture'); } return session; },
    async policies() { return { ...draftPolicies, status: 'PUBLISHED', operator: { name: '검수 전용', address: '검수 전용', email: user.email }, documents: draftPolicies.documents.map(d => ({ ...d, version: scenario === 'email-stale' && failedSignup ? 'fixture-3' : 'fixture-2' })) }; },
    async beginSignIn(p) { await wait(); if (scenario === 'social-existing' || scenario === 'social-new' || scenario === 'social-cancel') return window.location.pathname + '?scenario=' + scenario + '&provider=' + p + '#profile'; throw new ServiceError(scenario === 'social-conflict' ? 409 : 503, 'fixture-no-redirect-' + p); },
    async completeSignup() { if (session.state !== 'PENDING_SIGNUP') throw new ServiceError(409, 'fixture-no-pending'); session = { state: 'SIGNED_IN', user: { ...user, provider: session.provider } }; return session.user; },
    async signInEmail(email, password) { await wait(); if (password === 'unverified') throw new ServiceError(409, 'verification'); if (password !== 'correct-password') throw new ServiceError(401, 'credentials'); session = { state: 'SIGNED_IN', user: { ...user, email } }; return session.user; },
    async signUpEmail(input) { await wait(); if ((scenario === 'signup-fail' || scenario === 'email-stale') && !failedSignup) { failedSignup = true; throw new ServiceError(scenario === 'email-stale' ? 412 : 503, 'fixture'); } return { state: 'VERIFICATION_REQUIRED', email: input.email }; },
    async verifyEmail(email, code) { await wait(); if (code !== '123456') throw new ServiceError(400, 'code'); session = { state: 'SIGNED_IN', user: { ...user, email } }; return session.user; },
    async resendVerification() { await wait(); }, async resetPassword() { await wait(); },
    async signOut() { await wait(); session = { state: 'GUEST' }; if (scenario === 'expired') throw new ServiceError(401, 'expired'); },
    async removeAccount() { await wait(); session = { state: 'GUEST' }; },
  };
  createRoot(document.getElementById('root')!).render(<><div className="account-fixture-banner">개발 검수 전용 · 실제 가입·인증·메일 발송 아님</div><App accountAdapter={adapter} /></>);
}
