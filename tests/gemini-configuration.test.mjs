import test from 'node:test';
import assert from 'node:assert/strict';
import { verificationPolicyEnvironment } from '../scripts/configure-large-model.mjs';

test('reauthentication refresh credentials replace stale file credentials and direct-token overrides', () => {
  const result = verificationPolicyEnvironment(
    { GEMINI_BILLING_VERIFICATION_CREDENTIALS: 'new-child-refresh', GEMINI_BILLING_VERIFICATION_TOKEN: 'inherited-stale-token', LARGE_MODEL_API_KEY: 'keep-process-key' },
    { GEMINI_BILLING_VERIFICATION_CREDENTIALS: 'old-file-refresh', GEMINI_BILLING_VERIFICATION_TOKEN: 'old-file-token', LARGE_MODEL_API_KEY: 'keep-file-key' },
  );
  assert.equal(result.GEMINI_BILLING_VERIFICATION_CREDENTIALS, 'new-child-refresh');
  assert.equal(result.GEMINI_BILLING_VERIFICATION_TOKEN, '');
  assert.equal(result.LARGE_MODEL_API_KEY, 'keep-file-key');
});

test('explicit direct tokens retain precedence while absent child verification values preserve file configuration', () => {
  const file = { GEMINI_BILLING_VERIFICATION_CREDENTIALS: 'file-refresh', GEMINI_BILLING_VERIFICATION_TOKEN: 'file-token', LARGE_MODEL_NAME: 'file-model' };
  assert.deepEqual(verificationPolicyEnvironment({ LARGE_MODEL_NAME: 'process-model' }, file), file);
  const direct = verificationPolicyEnvironment({ GEMINI_BILLING_VERIFICATION_TOKEN: 'new-child-token' }, file);
  assert.equal(direct.GEMINI_BILLING_VERIFICATION_TOKEN, 'new-child-token');
  assert.equal(direct.GEMINI_BILLING_VERIFICATION_CREDENTIALS, 'file-refresh');
});

test('an explicit child verification quota project overrides only that file setting', () => {
  const file = { GEMINI_BILLING_VERIFICATION_PROJECT: 'old-quota-project', LARGE_MODEL_API_KEY: 'keep-file-key' };
  const result = verificationPolicyEnvironment({ GEMINI_BILLING_VERIFICATION_PROJECT: 'new-quota-project', LARGE_MODEL_API_KEY: 'process-key' }, file);
  assert.equal(result.GEMINI_BILLING_VERIFICATION_PROJECT, 'new-quota-project');
  assert.equal(result.LARGE_MODEL_API_KEY, 'keep-file-key');
  assert.equal(verificationPolicyEnvironment({ GEMINI_BILLING_VERIFICATION_PROJECT: '' }, file).GEMINI_BILLING_VERIFICATION_PROJECT, '');
});
