import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { readGeminiFreePolicy, reserveGeminiFreeCall, isFreeGeminiTextModel } = await import('../lib/gemini-free-policy.ts');
const { predictLargeModel, readLargeModelConfig, readLocalLargeModelConfig, readEscalationModelConfigs } = await import('../lib/large-model-adapter.ts');
const { createTripSession } = await import('../lib/trip-engine.ts');

const policy = { verificationAccessToken: 'test-only-oauth-access-token', maxRequestsPerMinute: 5, maxRequestsPerDay: 20 };
let sequence = 0;
const key = () => `test-only-free-key-${++sequence}`;
const request = () => ({ protocolVersion: 1, requestId: 'free-only-test', sessionId: 'free-only-test', baseRevision: 1, session: createTripSession(), action: { type: 'message', text: '부산 여행 준비물을 알려줘.' } });
const config = (apiKey = key()) => ({ provider: 'gemini', model: 'gemini-3.6-flash', apiKey, timeoutMs: 1000, freePolicy: policy });
const lookup = { parent: 'projects/123456/locations/global', name: 'projects/123456/locations/global/keys/actual-key' };
const billing = { name: 'projects/verified-project/billingInfo', projectId: 'verified-project', billingEnabled: false, billingAccountName: '' };
const credentials = () => ({ type: 'authorized_user', client_id: '123456789012-testclientidentifier.apps.googleusercontent.com', client_secret: 'test-only-client-secret-not-real', refresh_token: `1//test-only-refresh-token-not-real-${++sequence}` });
const refreshPolicy = (value = credentials()) => readGeminiFreePolicy({ GEMINI_BILLING_VERIFICATION_CREDENTIALS: JSON.stringify(value) });

function verifier({ keyResponse = lookup, billingResponse = billing, lookupStatus = 200, billingStatus = 200, generateStatus = 200 } = {}) {
  const calls = [];
  return { calls, async fetch(url, init) {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('https://apikeys.googleapis.com/')) return Response.json(keyResponse, { status: lookupStatus });
    if (String(url).startsWith('https://cloudbilling.googleapis.com/')) return Response.json(billingResponse, { status: billingStatus });
    assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.6-flash:generateContent$/);
    return generateStatus === 200 ? Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"message":"일반 지식에 따른 준비 안내예요.","actions":[]}' }] } }] }) : new Response('private upstream detail', { status: generateStatus, headers: { 'retry-after': '120' } });
  } };
}

test('an API key and free model name alone cannot send any remote request', async () => {
  const selected = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: 'gemini-3.6-flash', LARGE_MODEL_API_KEY: key() });
  let calls = 0;
  await assert.rejects(predictLargeModel(request(), selected, async () => { calls++; throw new Error('must not fetch'); }), { code: 'LARGE_MODEL_FREE_TIER_UNVERIFIED' });
  assert.equal(calls, 0);
});

test('every allowed generation freshly binds the actual key to an unbilled project', async () => {
  const selected = config();
  const mock = verifier();
  for (let index = 0; index < 2; index++) await predictLargeModel(request(), selected, mock.fetch);
  assert.equal(mock.calls.length, 6);
  for (const offset of [0, 3]) {
    assert.equal(mock.calls[offset].url, `https://apikeys.googleapis.com/v2/keys:lookupKey?keyString=${encodeURIComponent(selected.apiKey)}`);
    assert.equal(mock.calls[offset + 1].url, 'https://cloudbilling.googleapis.com/v1/projects/123456/billingInfo');
    assert.equal(mock.calls[offset].init.headers.Authorization, `Bearer ${policy.verificationAccessToken}`);
    assert.equal(mock.calls[offset + 1].init.redirect, 'manual');
    assert.equal(mock.calls[offset + 2].init.headers['x-goog-api-key'], selected.apiKey);
    assert.equal(mock.calls[offset + 2].init.headers.Authorization, undefined);
    assert.equal(JSON.parse(mock.calls[offset + 2].init.body).tools, undefined);
  }
});

test('billing enabled, attached accounts, missing fields and an unrelated key project deny generation', async () => {
  for (const change of [
    { billingResponse: { ...billing, billingEnabled: true } },
    { billingResponse: { ...billing, billingAccountName: 'billingAccounts/attached' } },
    { billingResponse: { name: billing.name, projectId: billing.projectId } },
    { billingResponse: { ...billing, name: 'projects/another-project/billingInfo' } },
    { keyResponse: { ...lookup, name: 'projects/987654/locations/global/keys/wrong-key' } },
    { lookupStatus: 403 }, { billingStatus: 403 },
  ]) {
    const mock = verifier(change);
    await assert.rejects(predictLargeModel(request(), config(), mock.fetch), (error) => /^LARGE_MODEL_(?:FREE_TIER_UNVERIFIED|BILLING_ENABLED)$/.test(error.code));
    assert.ok(mock.calls.every(call => !call.url.includes('generateContent')));
  }
});

test('enabled billing is rechecked on the next request rather than cached as free', async () => {
  const selected = config();
  const first = verifier();
  await predictLargeModel(request(), selected, first.fetch);
  const changed = verifier({ billingResponse: { ...billing, billingEnabled: true, billingAccountName: 'billingAccounts/new' } });
  await assert.rejects(predictLargeModel(request(), selected, changed.fetch), { code: 'LARGE_MODEL_BILLING_ENABLED' });
  assert.equal(changed.calls.length, 2);
});

test('paid-only and unapproved models cannot use the billing verification token to generate', async () => {
  for (const model of ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-3.8-flash-image', 'gemini-9.9-flash']) assert.equal(isFreeGeminiTextModel(model), false);
  for (const model of ['gemini-3.6-flash', 'gemini-3.8-flash']) assert.equal(isFreeGeminiTextModel(model), true);
  let calls = 0;
  await assert.rejects(predictLargeModel(request(), { ...config(), model: 'gemini-2.5-pro' }, async () => { calls++; throw new Error('must not fetch'); }), { code: 'LARGE_MODEL_FREE_MODEL_UNSUPPORTED' });
  assert.equal(calls, 0);
});

test('quota exhaustion opens a circuit without retrying or calling Google again', async () => {
  const selected = config();
  const mock = verifier({ generateStatus: 429 });
  await assert.rejects(predictLargeModel(request(), selected, mock.fetch), { code: 'LARGE_MODEL_QUOTA_EXCEEDED' });
  assert.equal(mock.calls.length, 3);
  await assert.rejects(predictLargeModel(request(), selected, mock.fetch), { code: 'LARGE_MODEL_FREE_LIMIT_REACHED' });
  assert.equal(mock.calls.length, 3);
});

test('concurrent calls and conservative app caps fall through before another remote request', async () => {
  const apiKey = key();
  const mock = verifier();
  const limited = { ...policy, maxRequestsPerMinute: 1, maxRequestsPerDay: 1 };
  const permit = await reserveGeminiFreeCall(apiKey, 'gemini-3.6-flash', limited, mock.fetch);
  await assert.rejects(reserveGeminiFreeCall(apiKey, 'gemini-3.6-flash', limited, mock.fetch), { code: 'LARGE_MODEL_FREE_LIMIT_REACHED' });
  permit.release();
  await assert.rejects(reserveGeminiFreeCall(apiKey, 'gemini-3.6-flash', limited, mock.fetch), { code: 'LARGE_MODEL_FREE_LIMIT_REACHED' });
  assert.equal(mock.calls.length, 2);
});

test('local fallback settings remain independent of Gemini keys and cannot point at a remote server', () => {
  assert.deepEqual(readLocalLargeModelConfig({ LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: 'gemini-3.6-flash', LARGE_MODEL_API_KEY: key() }), { provider: 'ollama', model: 'qwen3:14b', baseUrl: 'http://127.0.0.1:11434', timeoutMs: 180000 });
  assert.throws(() => readLocalLargeModelConfig({ LOCAL_LARGE_MODEL_BASE_URL: 'https://paid-api.example/' }), { code: 'LARGE_MODEL_CONFIG_INVALID' });
  assert.equal(readEscalationModelConfigs({ LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: 'gemini-3.6-flash', LARGE_MODEL_API_KEY: '' }).large.provider, 'ollama');
  for (const env of [{ GEMINI_FREE_MAX_REQUESTS_PER_MINUTE: '6' }, { GEMINI_FREE_MAX_REQUESTS_PER_DAY: '21' }, { GEMINI_BILLING_VERIFICATION_TOKEN: 'bad\r\nheader' }]) assert.throws(() => readGeminiFreePolicy(env), { code: 'LARGE_MODEL_FREE_POLICY_INVALID' });
});

test('authorized_user credentials refresh at the fixed OAuth endpoint and survive adapter configuration revalidation', async () => {
  const actualCredentials = credentials();
  const selected = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: 'gemini-3.6-flash', LARGE_MODEL_API_KEY: key(), GEMINI_BILLING_VERIFICATION_CREDENTIALS: JSON.stringify(actualCredentials) });
  assert.deepEqual(selected.freePolicy.verificationCredentials, actualCredentials);
  const mock = verifier();
  const calls = [];
  const accessToken = 'test-refreshed-access-token-not-real';
  const reply = await predictLargeModel(request(), selected, async (url, init) => {
    calls.push({ url: String(url), init });
    if (url === 'https://oauth2.googleapis.com/token') {
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'manual');
      assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded');
      assert.equal(init.headers.Authorization, undefined);
      const body = new URLSearchParams(init.body);
      assert.deepEqual(Object.fromEntries(body), { grant_type: 'refresh_token', client_id: actualCredentials.client_id, client_secret: actualCredentials.client_secret, refresh_token: actualCredentials.refresh_token });
      return Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 3600 });
    }
    if (String(url).startsWith('https://apikeys.googleapis.com/') || String(url).startsWith('https://cloudbilling.googleapis.com/')) assert.equal(init.headers.Authorization, `Bearer ${accessToken}`);
    return mock.fetch(url, init);
  });
  assert.equal(calls.length, 4);
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  for (const secret of [actualCredentials.client_secret, actualCredentials.refresh_token, accessToken]) {
    assert.equal(JSON.stringify(reply).includes(secret), false);
    assert.equal(calls.at(-1).init.body.includes(secret), false);
  }
});

test('cached access tokens are reused only before expiry and refresh rotation still rechecks billing every request', async () => {
  const selected = { ...config(), freePolicy: refreshPolicy() };
  const mock = verifier();
  const actualNow = Date.now;
  let now = actualNow();
  let refreshes = 0;
  const authorizations = [];
  const fetcher = async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: `test-rotated-access-token-${++refreshes}`, token_type: 'Bearer', expires_in: 3600 });
    if (String(url).startsWith('https://apikeys.googleapis.com/')) authorizations.push(init.headers.Authorization);
    return mock.fetch(url, init);
  };
  Date.now = () => now;
  try {
    await predictLargeModel(request(), selected, fetcher);
    await predictLargeModel(request(), selected, fetcher);
    assert.equal(refreshes, 1);
    now += 3540000;
    await predictLargeModel(request(), selected, fetcher);
    assert.equal(refreshes, 2);
    assert.deepEqual(authorizations, ['Bearer test-rotated-access-token-1', 'Bearer test-rotated-access-token-1', 'Bearer test-rotated-access-token-2']);
    assert.equal(mock.calls.filter(call => call.url.includes('/billingInfo')).length, 3);
  } finally { Date.now = actualNow; }
});

test('legacy short-lived access tokens retain precedence without exposing refresh credentials', async () => {
  const selected = { ...config(), freePolicy: { ...refreshPolicy(), verificationAccessToken: policy.verificationAccessToken } };
  const mock = verifier();
  await predictLargeModel(request(), selected, mock.fetch);
  assert.equal(mock.calls.length, 3);
  assert.equal(mock.calls[0].init.headers.Authorization, `Bearer ${policy.verificationAccessToken}`);
});

test('expired, malformed, redirected and revoked refresh responses deny inference without exposing secrets', async () => {
  for (const options of [
    { body: { error: 'invalid_grant', error_description: 'revoked test refresh token' }, status: 400 },
    { body: { access_token: 'test-expired-access-token', token_type: 'Bearer', expires_in: 0 } },
    { body: { access_token: 'test-access-token', token_type: 'Bearer', expires_in: -10 } },
    { body: { access_token: 'test-access-token', token_type: 'Bearer', expires_in: '3600' } },
    { body: { access_token: 'test-access-token', token_type: 'Bearer', expires_in: 999999 } },
    { body: { access_token: 'test\r\nunsafe-access-token', token_type: 'Bearer', expires_in: 3600 } },
    { body: { access_token: 'test-access-token', token_type: 'Basic', expires_in: 3600 } },
    { body: { token_type: 'Bearer', expires_in: 3600 } },
    { body: { access_token: 'test-access-token', token_type: 'Bearer', expires_in: 3600, error: 'unexpected_error' } },
    { body: {}, status: 302 }, { malformed: true }, { network: true },
  ]) {
    const actualCredentials = credentials();
    const selected = { ...config(), freePolicy: refreshPolicy(actualCredentials) };
    const calls = [];
    await assert.rejects(predictLargeModel(request(), selected, async (url) => {
      calls.push(String(url));
      assert.equal(url, 'https://oauth2.googleapis.com/token');
      if (options.network) throw new Error(`private ${actualCredentials.refresh_token} ${actualCredentials.client_secret}`);
      if (options.malformed) return new Response('{private malformed token response');
      return Response.json(options.body, { status: options.status || 200 });
    }), (error) => error.code === 'LARGE_MODEL_FREE_TIER_UNVERIFIED' && !JSON.stringify({ message: error.message, stack: error.stack }).includes(actualCredentials.refresh_token) && !error.message.includes(actualCredentials.client_secret));
    assert.equal(calls.length, 1);
  }
});

test('unauthorized verification invalidates a cached refreshed token and requires another refresh', async () => {
  const selected = { ...config(), freePolicy: refreshPolicy() };
  const mock = verifier();
  let refreshes = 0;
  let lookups = 0;
  const fetcher = async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: `test-revocation-access-token-${++refreshes}`, token_type: 'Bearer', expires_in: 3600 });
    if (String(url).startsWith('https://apikeys.googleapis.com/') && ++lookups === 2) return Response.json({ error: { message: 'revoked access token' } }, { status: 401 });
    return mock.fetch(url, init);
  };
  await predictLargeModel(request(), selected, fetcher);
  await assert.rejects(predictLargeModel(request(), selected, fetcher), { code: 'LARGE_MODEL_FREE_TIER_UNVERIFIED' });
  await predictLargeModel(request(), selected, fetcher);
  assert.equal(refreshes, 2);
  assert.equal(lookups, 3);
  assert.equal(mock.calls.filter(call => call.url.includes('generateContent')).length, 2);
});

test('credential JSON rejects extra endpoints, wrong types, invalid Google client IDs and control characters', () => {
  const valid = credentials();
  for (const value of [null, [], {}, { ...valid, type: 'service_account' }, { ...valid, token_uri: 'https://attacker.example/token' }, { ...valid, client_id: 'client.attacker.example' }, { ...valid, client_secret: 'bad\r\nsecret-value' }, { ...valid, refresh_token: 'bad\nrefresh-token-secret-value' }, { ...valid, refresh_token: 123 }, { ...valid, refresh_token: 'x'.repeat(4097) }]) {
    assert.throws(() => readGeminiFreePolicy({ GEMINI_BILLING_VERIFICATION_CREDENTIALS: JSON.stringify(value) }), { code: 'LARGE_MODEL_FREE_POLICY_INVALID' });
  }
  assert.throws(() => readGeminiFreePolicy({ GEMINI_BILLING_VERIFICATION_CREDENTIALS: '{private malformed credentials' }), { code: 'LARGE_MODEL_FREE_POLICY_INVALID' });
});

test('a cached OAuth token cannot authorize a second generation after project billing changes', async () => {
  const selected = { ...config(), freePolicy: refreshPolicy() };
  const mock = verifier();
  let refreshes = 0;
  let billingChecks = 0;
  const fetcher = async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') { refreshes++; return Response.json({ access_token: 'test-cached-access-token-not-real', token_type: 'Bearer', expires_in: 3600 }); }
    if (String(url).endsWith('/billingInfo') && ++billingChecks === 2) return Response.json({ ...billing, billingEnabled: true, billingAccountName: 'billingAccounts/changed' });
    return mock.fetch(url, init);
  };
  await predictLargeModel(request(), selected, fetcher);
  await assert.rejects(predictLargeModel(request(), selected, fetcher), { code: 'LARGE_MODEL_BILLING_ENABLED' });
  assert.equal(refreshes, 1);
  assert.equal(billingChecks, 2);
  assert.equal(mock.calls.filter(call => call.url.includes('generateContent')).length, 1);
});

test('the existing five-second verification deadline also bounds an OAuth refresh that ignores cancellation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  let calls = 0;
  const pending = reserveGeminiFreeCall(key(), 'gemini-3.6-flash', refreshPolicy(), (url, init) => {
    calls++;
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    signal = init.signal;
    return new Promise(() => {});
  });
  const rejected = assert.rejects(pending, { code: 'LARGE_MODEL_FREE_TIER_UNVERIFIED' });
  t.mock.timers.tick(4999);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
});

test('oversized and non-completing OAuth response bodies cannot escape bounded verification', async (t) => {
  for (const response of [new Response('{}', { headers: { 'content-length': '20000' } }), new Response('x'.repeat(17000))]) {
    let calls = 0;
    await assert.rejects(reserveGeminiFreeCall(key(), 'gemini-3.6-flash', refreshPolicy(), async () => { calls++; return response; }), { code: 'LARGE_MODEL_FREE_TIER_UNVERIFIED' });
    assert.equal(calls, 1);
  }
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = reserveGeminiFreeCall(key(), 'gemini-3.6-flash', refreshPolicy(), async () => new Response(new ReadableStream({})));
  const rejected = assert.rejects(pending, { code: 'LARGE_MODEL_FREE_TIER_UNVERIFIED' });
  t.mock.timers.tick(5000);
  await rejected;
});

test('the optional quota-project header survives adapter revalidation only on key and billing verification GETs', async () => {
  const actualCredentials = credentials();
  const quotaProject = 'consumer-project-123';
  const selected = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: 'gemini-3.6-flash', LARGE_MODEL_API_KEY: key(), GEMINI_BILLING_VERIFICATION_CREDENTIALS: JSON.stringify(actualCredentials), GEMINI_BILLING_VERIFICATION_PROJECT: quotaProject });
  assert.equal(selected.freePolicy.verificationProject, quotaProject);
  const mock = verifier();
  let refreshes = 0;
  const reply = await predictLargeModel(request(), selected, async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      refreshes++;
      assert.equal(init.headers['x-goog-user-project'], undefined);
      return Response.json({ access_token: 'test-quota-project-access-token', token_type: 'Bearer', expires_in: 3600 });
    }
    if (String(url).includes('generateContent')) assert.equal(init.headers['x-goog-user-project'], undefined);
    else {
      assert.equal(init.headers['x-goog-user-project'], quotaProject);
      assert.equal(init.method, undefined, 'verification remains a read-only GET');
    }
    return mock.fetch(url, init);
  });
  assert.equal(refreshes, 1);
  assert.equal(reply.actions.length, 0);
  assert.equal(mock.calls[1].url, 'https://cloudbilling.googleapis.com/v1/projects/123456/billingInfo', 'the actual key project, not the quota project, remains the billing target');
});

test('a quota project alone cannot establish free eligibility or trigger a remote request', async () => {
  const selected = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: 'gemini-3.6-flash', LARGE_MODEL_API_KEY: key(), GEMINI_BILLING_VERIFICATION_PROJECT: '123456789012' });
  assert.equal(selected.freePolicy.verificationProject, '123456789012');
  let calls = 0;
  await assert.rejects(predictLargeModel(request(), selected, async () => { calls++; throw new Error('must not fetch'); }), { code: 'LARGE_MODEL_FREE_TIER_UNVERIFIED' });
  assert.equal(calls, 0);
});

test('quota-project validation rejects headers, URLs, resource paths and noncanonical identifiers', () => {
  for (const project of ['valid-project', 'gen-lang-client-0855183959', '123456789012']) assert.equal(readGeminiFreePolicy({ GEMINI_BILLING_VERIFICATION_PROJECT: project }).verificationProject, project);
  for (const value of ['project\r\nx-other: secret', 'https://attacker.example', 'projects/123456789012', 'project with spaces', 'project-id ', 'Project-ID', '0123456789', '123', '-project', 'project-', 'a'.repeat(31), 123456789012, null]) {
    assert.throws(() => readGeminiFreePolicy({ GEMINI_BILLING_VERIFICATION_PROJECT: value }), { code: 'LARGE_MODEL_FREE_POLICY_INVALID' });
  }
  let calls = 0;
  return assert.rejects(predictLargeModel(request(), { ...config(), freePolicy: { ...policy, verificationProject: 'project\r\nx-injected: secret' } }, async () => { calls++; throw new Error('must not fetch'); }), (error) => error.code === 'LARGE_MODEL_FREE_POLICY_INVALID' && calls === 0);
});
