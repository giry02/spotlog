import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_METHODS, accountProviderName } from '../src/accountMethods.ts';
import { createSocialAccountAdapter, validateAuthorizeUrl, validateSocialSession, validateSocialUser } from '../src/socialAccountService.ts';
import { draftPolicies } from '../src/accountPolicies.ts';

const signal = () => new AbortController().signal;
const consent = { terms: true, collection: true, age: true, marketing: false };
const policies = () => ({ ...structuredClone(draftPolicies), status: 'PUBLISHED', operator: { name: '시험 운영자', address: '시험 주소', email: 'qa@example.invalid' }, documents: draftPolicies.documents.map(d => ({ ...d, version: 'test-1' })) });
const urls = {
  KAKAO: 'https://kauth.kakao.com/oauth/authorize', NAVER: 'https://nid.naver.com/oauth2.0/authorize',
  GOOGLE: 'https://accounts.google.com/o/oauth2/v2/auth', APPLE: 'https://appleid.apple.com/auth/authorize',
};
const user = provider => ({ id: `member-${provider}`, displayName: '시험 여행자', email: provider === 'EMAIL' ? 'qa@example.invalid' : null, provider });

test('both entry flows share five ordered methods and Korean provider labels', () => {
  assert.deepEqual(ACCOUNT_METHODS, ['KAKAO', 'NAVER', 'GOOGLE', 'APPLE', 'EMAIL']);
  assert.deepEqual(ACCOUNT_METHODS.map(accountProviderName), ['카카오', '네이버', 'Google', 'Apple', '이메일']);
});

test('five verified membership providers are accepted; only social providers can await signup', () => {
  for (const provider of ACCOUNT_METHODS) {
    assert.equal(validateSocialUser(user(provider)).provider, provider);
    assert.deepEqual(validateSocialSession({ state: 'SIGNED_IN', user: user(provider) }), { state: 'SIGNED_IN', user: user(provider) });
    if (provider !== 'EMAIL') assert.deepEqual(validateSocialSession({ state: 'PENDING_SIGNUP', provider }), { state: 'PENDING_SIGNUP', provider });
  }
  for (const provider of ['EMAIL', 'UNKNOWN', '', null]) assert.throws(() => validateSocialSession({ state: 'PENDING_SIGNUP', provider }));
  assert.throws(() => validateSocialUser(user('UNKNOWN')));
  assert.throws(() => validateSocialUser({ ...user('EMAIL'), email: null }));
});

test('social authorization never redirects to another provider or an arbitrary HTTPS host', () => {
  for (const [selected, url] of Object.entries(urls)) {
    assert.equal(validateAuthorizeUrl(url, selected), url);
    for (const [other, otherUrl] of Object.entries(urls)) if (other !== selected) assert.throws(() => validateAuthorizeUrl(otherUrl, selected));
    const parsed = new URL(url);
    for (const bad of [`http://${parsed.host}${parsed.pathname}`, `https://${parsed.host}.example.invalid${parsed.pathname}`, `https://user:secret@${parsed.host}${parsed.pathname}`, `https://${parsed.host}:8443${parsed.pathname}`, `https://${parsed.host}.${parsed.pathname}`]) assert.throws(() => validateAuthorizeUrl(bad, selected));
  }
  assert.throws(() => validateAuthorizeUrl(urls.GOOGLE, 'EMAIL'));
});

test('selected signup/login intent reaches the server; no frontend identity is submitted', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push({ path, options });
    const selected = path.split('/').at(-2).toUpperCase();
    return Response.json({ authorizeUrl: urls[selected] });
  });
  const adapter = createSocialAccountAdapter('/api/account');
  for (const selected of Object.keys(urls)) for (const intent of ['login', 'signup']) {
    assert.equal(await adapter.beginSignIn(selected, '/spotlog/#profile', signal(), intent), urls[selected]);
    const last = calls.at(-1);
    assert.equal(last.path, `/api/account/oauth/${selected.toLowerCase()}/start`);
    assert.deepEqual(JSON.parse(last.options.body), { returnTo: '/spotlog/#profile', intent });
    assert.equal(last.options.credentials, 'same-origin');
    assert.equal(last.options.cache, 'no-store');
  }
  await adapter.beginSignIn('GOOGLE', '/#profile', signal());
  assert.equal(JSON.parse(calls.at(-1).options.body).intent, 'login');
  const count = calls.length;
  for (const intent of ['auto', null, '', 0]) await assert.rejects(adapter.beginSignIn('GOOGLE', '/#profile', signal(), intent));
  await assert.rejects(adapter.beginSignIn('EMAIL', '/#profile', signal(), 'signup'));
  await assert.rejects(adapter.beginSignIn('KAKAO', '//external.invalid', signal(), 'login'));
  assert.equal(calls.length, count);
});

test('server session decides existing membership even for a signup entry', async t => {
  let response = { state: 'GUEST' };
  t.mock.method(globalThis, 'fetch', async () => Response.json(response));
  const adapter = createSocialAccountAdapter('/api/account');
  assert.deepEqual(await adapter.session(signal()), { state: 'GUEST' });
  for (const selected of Object.keys(urls)) {
    response = { state: 'PENDING_SIGNUP', provider: selected };
    assert.deepEqual(await adapter.session(signal()), response);
    response = { state: 'SIGNED_IN', user: user(selected) };
    assert.deepEqual(await adapter.session(signal()), response);
  }
});

test('signup result must match the authenticated pending provider; email endpoints require EMAIL', async t => {
  let returned = user('KAKAO');
  t.mock.method(globalThis, 'fetch', async () => Response.json(returned));
  const adapter = createSocialAccountAdapter('/api/account');
  assert.equal((await adapter.completeSignup(policies(), consent, signal(), 'KAKAO')).provider, 'KAKAO');
  await assert.rejects(adapter.completeSignup(policies(), consent, signal(), 'NAVER'), e => e.status === 502);
  await assert.rejects(adapter.signInEmail('qa@example.invalid', 'test-password', signal()), e => e.status === 502);
  await assert.rejects(adapter.verifyEmail('qa@example.invalid', '123456', signal()), e => e.status === 502);
  returned = user('EMAIL');
  await assert.rejects(adapter.completeSignup(policies(), consent, signal()), e => e.status === 502);
  assert.equal((await adapter.signInEmail('qa@example.invalid', 'test-password', signal())).provider, 'EMAIL');
  assert.equal((await adapter.verifyEmail('qa@example.invalid', '123456', signal())).provider, 'EMAIL');
});

test('unconfigured social methods never perform requests or forge registered sessions', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('unexpected fetch'); });
  const adapter = createSocialAccountAdapter('');
  for (const selected of Object.keys(urls)) {
    await assert.rejects(adapter.beginSignIn(selected, '/#profile', signal(), 'login'), e => e.status === 0);
    await assert.rejects(adapter.beginSignIn(selected, '/#profile', signal(), 'signup'), e => e.status === 0);
  }
  assert.deepEqual(await adapter.session(signal()), { state: 'GUEST' });
  assert.equal(calls, 0);
});
