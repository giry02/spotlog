import test from 'node:test';
import assert from 'node:assert/strict';
import { parse as parseDotenv } from 'dotenv';
import { extractAuthorizedUserCredentials, replaceVerificationCredentials, loginScopes } from '../scripts/authenticate-gemini-free.mjs';

const credentials = { type: 'authorized_user', client_id: '123456789012-test-client-fixture.apps.googleusercontent.com', client_secret: 'test-client-secret', refresh_token: 'test-refresh-token-long-enough' };

await test('Google login explicitly discloses the official CLI management scope', () => {
  assert.ok(loginScopes.includes('https://www.googleapis.com/auth/cloud-platform'));
  assert.ok(!loginScopes.some(scope => /drive|gmail|calendar/.test(scope)));
});

await test('only the four authorized-user fields can enter server configuration', () => {
  assert.deepEqual(extractAuthorizedUserCredentials({ ...credentials, token_uri: 'https://untrusted.example/token', quota_project_id: 'not-to-be-used', arbitrary: 'secret-extra' }), credentials);
  for (const change of [{ type: 'service_account' }, { client_id: 'https://untrusted.example' }, { client_secret: 'bad\r\nheader' }, { client_secret: "must-not-inject'quotes" }, { refresh_token: '' }]) assert.throws(() => extractAuthorizedUserCredentials({ ...credentials, ...change }), { message: 'CREDENTIALS_INVALID' });
});

await test('saving refresh credentials preserves the existing key and removes stale token overrides', () => {
  const existing = 'LARGE_MODEL_API_KEY="keep-this-test-key"\r\nGEMINI_BILLING_VERIFICATION_TOKEN="obsolete-token"\r\nOTHER_SETTING="keep"\r\nGEMINI_BILLING_VERIFICATION_CREDENTIALS="obsolete"\r\n';
  const result = replaceVerificationCredentials(existing, credentials);
  assert.ok(result.includes('LARGE_MODEL_API_KEY="keep-this-test-key"'));
  assert.ok(result.includes('OTHER_SETTING="keep"'));
  assert.ok(!result.includes('obsolete'));
  const binding = parseDotenv(result).GEMINI_BILLING_VERIFICATION_CREDENTIALS;
  assert.deepEqual(JSON.parse(binding), credentials);
  assert.equal(result.split('\n').filter(item => item.startsWith('GEMINI_BILLING_VERIFICATION_CREDENTIALS=')).length, 1);
});
