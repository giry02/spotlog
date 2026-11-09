import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAccountAdapterMode, initialEmailLoginCredentials } from '../src/accountEntry.ts';
import { createReviewAccountAdapter } from '../src/reviewAccountService.ts';
import { createSocialAccountAdapter } from '../src/socialAccountService.ts';

const signal = () => new AbortController().signal;
const empty = { email: '', password: '' };

test('an explicit service endpoint takes precedence over development and static-preview settings', () => {
  for (const endpoint of ['/api/account', '/api/account/', 'https://untrusted.example.invalid/auth', ' ']) {
    for (const development of [false, true]) {
      for (const reviewMode of [undefined, '', '0', '1', 'true']) {
        assert.equal(selectAccountAdapterMode({ endpoint, development, reviewMode }), 'SERVICE');
      }
    }
  }
});

test('only development or the exact explicit preview flag enables a review account without a service', () => {
  for (const reviewMode of [undefined, '', '0', 'false', 'true', '01', ' 1', '1 ']) {
    assert.equal(selectAccountAdapterMode({ endpoint: '', development: false, reviewMode }), 'UNCONNECTED');
    assert.equal(selectAccountAdapterMode({ endpoint: '', development: true, reviewMode }), 'REVIEW');
  }
  assert.equal(selectAccountAdapterMode({ endpoint: '', development: false, reviewMode: '1' }), 'REVIEW');
});

test('the direct-email entry receives the complete usable review pair just like the login chooser', async () => {
  for (const initialEntry of [undefined, 'email']) {
    const adapter = createReviewAccountAdapter(null);
    const credentials = initialEmailLoginCredentials({ initialView: 'login', initialEntry, reviewAccount: adapter.reviewAccount });
    assert.deepEqual(credentials, adapter.reviewAccount);
    assert.equal((await adapter.session(signal())).state, 'GUEST');
    const user = await adapter.signInEmail(credentials.email, credentials.password, signal());
    assert.equal(user.id, 'spotlog-local-review-member');
    assert.equal((await adapter.session(signal())).state, 'SIGNED_IN');
  }
});

test('signup, management, deletion and logout entries cannot inherit a review password', () => {
  const reviewAccount = Object.freeze({ email: 'review@example.invalid', password: 'ReviewPassword123!' });
  for (const initialView of ['signup', 'manage']) {
    for (const initialEntry of [undefined, 'email', 'logout', 'delete']) {
      assert.deepEqual(initialEmailLoginCredentials({ initialView, initialEntry, reviewAccount }), empty);
    }
  }
  for (const initialEntry of ['logout', 'delete']) {
    assert.deepEqual(initialEmailLoginCredentials({ initialView: 'login', initialEntry, reviewAccount }), empty);
  }
  assert.deepEqual(reviewAccount, { email: 'review@example.invalid', password: 'ReviewPassword123!' });
});

test('service login starts empty even when a prior member email is available', () => {
  for (const initialView of ['login', 'signup', 'manage']) {
    for (const initialEntry of [undefined, 'email', 'logout', 'delete']) {
      assert.deepEqual(initialEmailLoginCredentials({ initialView, initialEntry, memberEmail: 'prior-member@example.invalid' }), empty);
    }
  }
});

test('password reset uses only the signed-in member email and never the review password', () => {
  const reviewAccount = { email: 'review@example.invalid', password: 'ReviewPassword123!' };
  for (const initialView of ['login', 'signup', 'manage']) {
    assert.deepEqual(initialEmailLoginCredentials({ initialView, initialEntry: 'reset', reviewAccount, memberEmail: 'own@example.invalid' }), { email: 'own@example.invalid', password: '' });
    for (const memberEmail of [undefined, null, '']) {
      assert.deepEqual(initialEmailLoginCredentials({ initialView, initialEntry: 'reset', reviewAccount, memberEmail }), empty);
    }
  }
});

test('a stored preview sign-in is not a service session and a real service failure remains a failure', async t => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const review = createReviewAccountAdapter(storage);
  await review.signInEmail(review.reviewAccount.email, review.reviewAccount.password, signal());
  const storedBefore = [...values];
  const calls = [];
  t.mock.method(globalThis, 'fetch', async path => { calls.push(path); return new Response(null, { status: 503 }); });
  assert.equal(selectAccountAdapterMode({ endpoint: '/api/account', development: true, reviewMode: '1' }), 'SERVICE');
  const service = createSocialAccountAdapter('/api/account');
  assert.equal(service.reviewAccount, undefined);
  await assert.rejects(service.session(signal()), error => error.status === 503);
  await assert.rejects(service.signInEmail(review.reviewAccount.email, review.reviewAccount.password, signal()), error => error.status === 503);
  assert.deepEqual(calls, ['/api/account/social/session', '/api/account/email/sign-in']);
  assert.deepEqual([...values], storedBefore);
  assert.equal((await review.session(signal())).state, 'SIGNED_IN');
});
