import { draftPolicies } from './accountPolicies.ts';
import { ServiceError } from './serviceRequest.ts';
import type { SocialAccountAdapter, SocialSession } from './socialAccountService.ts';

const sessionKey = 'spotlog.review.account.session.v1';
type ReviewStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** Imported only by the DEV fallback. This is not production authentication. */
export function createReviewAccountAdapter(suppliedStorage?: ReviewStorage | null): SocialAccountAdapter {
  const reviewAccount = { email: 'demo@spotlog.test', password: 'SpotlogDemo123!' };
  const user = { id: 'spotlog-local-review-member', displayName: '검수 여행자', email: reviewAccount.email, provider: 'EMAIL' as const };
  let storage = suppliedStorage, signed = false;
  if (storage === undefined) try { storage = window.sessionStorage; } catch { storage = null; }
  const read = () => { try { return storage ? storage.getItem(sessionKey) === 'signed' : signed; } catch { storage = null; return signed; } };
  const write = (value: boolean) => { signed = value; try { if (value) storage?.setItem(sessionKey, 'signed'); else storage?.removeItem(sessionKey); } catch { storage = null; /* memory-only review remains usable */ } };
  const session = (): SocialSession => read() ? { state: 'SIGNED_IN', user: { ...user } } : { state: 'GUEST' };
  const unavailable = async () => { throw new ServiceError(503, 'review-only-unavailable'); };
  return {
    configured: true, reviewAccount,
    async session(signal) { signal.throwIfAborted(); return session(); },
    async policies(signal) { signal.throwIfAborted(); return structuredClone(draftPolicies); },
    async signInEmail(email, password, signal) {
      signal.throwIfAborted();
      if (email.trim().toLowerCase() !== reviewAccount.email || password !== reviewAccount.password) throw new ServiceError(401, 'review-credentials');
      write(true); return { ...user };
    },
    async signOut(signal) { signal.throwIfAborted(); write(false); },
    beginSignIn: unavailable, completeSignup: unavailable, signUpEmail: unavailable,
    verifyEmail: unavailable, resendVerification: unavailable, resetPassword: unavailable, removeAccount: unavailable,
  };
}
