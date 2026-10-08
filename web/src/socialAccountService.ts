import { isRecord, requestJson, servicePath, ServiceError } from './serviceRequest.ts';
import { type PolicyBundle, type PolicyId, type SignupChoices, signupConsentPayload } from './accountPolicies.ts';

export type LoginProvider = 'GOOGLE' | 'APPLE';
export type AccountProvider = 'EMAIL' | LoginProvider;
export interface SocialAccountUser { id: string; displayName: string; email: string | null; provider: AccountProvider }
export interface EmailSignup { email: string; password: string; displayName: string }
export type SocialSession = { state: 'GUEST' } | { state: 'PENDING_SIGNUP'; provider: LoginProvider } | { state: 'SIGNED_IN'; user: SocialAccountUser };
export interface SocialAccountAdapter {
  configured: boolean;
  /** Explicit local QA identity only; real API adapters never supply credentials. */
  reviewAccount?: { email: string; password: string };
  session(signal: AbortSignal): Promise<SocialSession>;
  policies(signal: AbortSignal): Promise<PolicyBundle>;
  beginSignIn(provider: LoginProvider, returnTo: string, signal: AbortSignal): Promise<string>;
  completeSignup(bundle: PolicyBundle, choices: SignupChoices, signal: AbortSignal): Promise<SocialAccountUser>;
  signInEmail(email: string, password: string, signal: AbortSignal): Promise<SocialAccountUser>;
  signUpEmail(input: EmailSignup, bundle: PolicyBundle, choices: SignupChoices, signal: AbortSignal): Promise<{ state: 'VERIFICATION_REQUIRED'; email: string }>;
  verifyEmail(email: string, code: string, signal: AbortSignal): Promise<SocialAccountUser>;
  resendVerification(email: string, signal: AbortSignal): Promise<void>;
  resetPassword(email: string, signal: AbortSignal): Promise<void>;
  signOut(signal: AbortSignal): Promise<void>;
  removeAccount(signal: AbortSignal): Promise<void>;
}
const provider = (v: unknown): v is LoginProvider => v === 'GOOGLE' || v === 'APPLE';
const text = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim());
export function validateSocialUser(value: unknown): SocialAccountUser {
  if (!isRecord(value) || !text(value.id) || !text(value.displayName) || !(provider(value.provider) || value.provider === 'EMAIL') || !(value.email === null || text(value.email)) || (value.provider === 'EMAIL' && !validEmail(value.email ?? ''))) throw new ServiceError(502, 'invalid-user');
  return { id: value.id, displayName: value.displayName, email: value.email as string | null, provider: value.provider };
}
export const validEmail = (value: string): boolean => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const validSignupPassword = (value: string): boolean => value.length >= 10 && value.length <= 128;
function emailInput(email: string, password?: string): string {
  if (!validEmail(email) || (password !== undefined && (!password || password.length > 128))) throw new ServiceError(0, 'invalid-email-input');
  return email.trim();
}
export function validateSocialSession(value: unknown): SocialSession {
  if (!isRecord(value)) throw new ServiceError(502, 'invalid-session');
  if (value.state === 'GUEST') return { state: 'GUEST' };
  if (value.state === 'PENDING_SIGNUP' && provider(value.provider)) return { state: 'PENDING_SIGNUP', provider: value.provider };
  if (value.state === 'SIGNED_IN') return { state: 'SIGNED_IN', user: validateSocialUser(value.user) };
  throw new ServiceError(502, 'invalid-session');
}
export function validatePolicies(value: unknown): PolicyBundle {
  const ids: PolicyId[] = ['terms', 'privacy', 'collection', 'location', 'marketing'];
  if (!isRecord(value) || !['DRAFT', 'PUBLISHED'].includes(String(value.status)) || !isRecord(value.operator) || ![value.operator.name, value.operator.address, value.operator.email].every(text) || !Number.isInteger(value.minimumAge) || Number(value.minimumAge) < 14 || typeof value.locationEnabled !== 'boolean' || !Array.isArray(value.documents) || value.documents.length !== ids.length) throw new ServiceError(502, 'invalid-policies');
  for (const id of ids) {
    const docs = value.documents.filter(d => isRecord(d) && d.id === id);
    const doc = docs[0];
    if (docs.length !== 1 || !isRecord(doc) || !text(doc.title) || !text(doc.version) || !Array.isArray(doc.sections) || !doc.sections.length || doc.sections.some(s => !isRecord(s) || !text(s.heading) || !Array.isArray(s.paragraphs) || !s.paragraphs.length || !s.paragraphs.every(text) || (s.points !== undefined && (!Array.isArray(s.points) || !s.points.every(text))))) throw new ServiceError(502, 'invalid-policies');
    if (value.status === 'PUBLISHED' && /draft/i.test(doc.version)) throw new ServiceError(502, 'draft-policies');
  }
  if (value.status === 'PUBLISHED' && Object.values(value.operator).some(v => v === '미정')) throw new ServiceError(502, 'operator-not-ready');
  return value as unknown as PolicyBundle;
}
export function validateAuthorizeUrl(value: unknown, selected: LoginProvider): string {
  if (!text(value)) throw new ServiceError(502, 'invalid-authorize-url');
  let url: URL;
  try { url = new URL(value); } catch { throw new ServiceError(502, 'invalid-authorize-url'); }
  const allowed = selected === 'GOOGLE' ? 'accounts.google.com' : 'appleid.apple.com';
  if (url.protocol !== 'https:' || url.hostname !== allowed || url.port || url.username || url.password) throw new ServiceError(502, 'invalid-authorize-url');
  return url.href;
}
export function validateReturnTo(value: string): string {
  // Only a route back into this app: never a token or unrestricted external redirect.
  if (!/^\/[\w./%-]*(?:#[\w%-]*)?$/.test(value) || value.startsWith('//') || /%2f|%5c|%2e/i.test(value) || value.includes('..')) throw new ServiceError(0, 'invalid-return-route');
  return value;
}
export function createSocialAccountAdapter(endpoint: string): SocialAccountAdapter {
  let path = '';
  try { if (endpoint) path = servicePath(endpoint).replace(/\/$/, ''); } catch { /* Disabled until configured safely. */ }
  const call = (suffix: string, signal: AbortSignal, body?: unknown) => {
    if (!path) throw new ServiceError(0, 'unconfigured');
    return requestJson(`${path}${suffix}`, { signal, method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'Spotlog' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  };
  return { configured: Boolean(path),
    async session(signal) { if (!path) return { state: 'GUEST' }; try { return validateSocialSession(await call('/social/session', signal)); } catch (e) { if (e instanceof ServiceError && e.status === 401) return { state: 'GUEST' }; throw e; } },
    async policies(signal) { return validatePolicies(await call('/policies', signal)); },
    async beginSignIn(selected, returnTo, signal) {
      if (!provider(selected)) throw new ServiceError(0, 'invalid-provider');
      const result = await call(`/oauth/${selected.toLowerCase()}/start`, signal, { returnTo: validateReturnTo(returnTo) });
      if (!isRecord(result)) throw new ServiceError(502, 'invalid-start');
      return validateAuthorizeUrl(result.authorizeUrl, selected);
    },
    async completeSignup(bundle, choices, signal) { return validateSocialUser(await call('/social/signup', signal, signupConsentPayload(validatePolicies(bundle), choices))); },
    async signInEmail(email, password, signal) { return validateSocialUser(await call('/email/sign-in', signal, { email: emailInput(email, password), password })); },
    async signUpEmail(input, bundle, choices, signal) {
      const email = emailInput(input.email, input.password);
      if (!validSignupPassword(input.password) || !input.displayName.trim() || input.displayName.trim().length > 40) throw new ServiceError(0, 'invalid-signup-input');
      const result = await call('/email/signup', signal, { ...input, email, displayName: input.displayName.trim(), consent: signupConsentPayload(validatePolicies(bundle), choices) });
      if (!isRecord(result) || result.state !== 'VERIFICATION_REQUIRED' || result.email !== email) throw new ServiceError(502, 'invalid-verification-state');
      return { state: 'VERIFICATION_REQUIRED', email };
    },
    async verifyEmail(email, code, signal) {
      if (!/^\d{6}$/.test(code)) throw new ServiceError(0, 'invalid-verification-code');
      return validateSocialUser(await call('/email/verify', signal, { email: emailInput(email), code }));
    },
    async resendVerification(email, signal) { await call('/email/verification/resend', signal, { email: emailInput(email) }); },
    async resetPassword(email, signal) { await call('/email/password-reset', signal, { email: emailInput(email) }); },
    async signOut(signal) { await call('/sign-out', signal, {}); },
    async removeAccount(signal) { await call('/delete', signal, { confirmed: true }); },
  };
}
