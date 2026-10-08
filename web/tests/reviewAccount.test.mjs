import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewAccountAdapter } from '../src/reviewAccountService.ts';

const signal = () => new AbortController().signal;
const memory = () => { const values = new Map(); return { values, storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } }; };

test('review account begins as guest, requires the preset pair, and persists only an explicit review flag', async () => {
  const {storage, values} = memory(), adapter = createReviewAccountAdapter(storage), credentials = adapter.reviewAccount;
  assert.deepEqual(await adapter.session(signal()), {state:'GUEST'});
  await assert.rejects(adapter.signInEmail(credentials.email, 'wrong', signal()), e => e.status === 401);
  assert.equal(values.size,0);
  const user = await adapter.signInEmail(credentials.email, credentials.password, signal());
  assert.equal(user.id,'spotlog-local-review-member');
  assert.deepEqual([...values.values()], ['signed']);
  assert.ok(!JSON.stringify([...values]).includes(credentials.password));
  assert.equal((await createReviewAccountAdapter(storage).session(signal())).state, 'SIGNED_IN');
  await adapter.signOut(signal()); assert.equal(values.size,0);
  assert.equal((await createReviewAccountAdapter(storage).session(signal())).state, 'GUEST');
});
test('review account never pretends to send mail, complete signup, authenticate a social provider or delete a service member', async () => {
  const adapter = createReviewAccountAdapter(null), s = signal();
  assert.equal((await adapter.policies(s)).status,'DRAFT');
  for (const op of [() => adapter.beginSignIn('GOOGLE','/#profile',s), () => adapter.completeSignup({}, {},s), () => adapter.signUpEmail({}, {},{},s), () => adapter.verifyEmail('x','123456',s), () => adapter.resendVerification('x',s), () => adapter.resetPassword('x',s), () => adapter.removeAccount(s)]) await assert.rejects(op(), e=>e.status===503);
  assert.equal((await adapter.session(s)).state,'GUEST');
});
test('aborted login never creates a review session; unavailable session storage falls back to memory', async () => {
  const {storage, values} = memory(), adapter = createReviewAccountAdapter(storage), c = new AbortController(); c.abort();
  await assert.rejects(adapter.signInEmail(adapter.reviewAccount.email, adapter.reviewAccount.password, c.signal));assert.equal(values.size,0);
  const unavailable = createReviewAccountAdapter({getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}});
  await unavailable.signInEmail(unavailable.reviewAccount.email, unavailable.reviewAccount.password, signal());
  assert.equal((await unavailable.session(signal())).state,'SIGNED_IN');
  await unavailable.signOut(signal());assert.equal((await unavailable.session(signal())).state,'GUEST');
});
