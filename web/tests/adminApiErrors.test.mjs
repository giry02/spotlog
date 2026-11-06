import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiAdminAdapter } from '../src/admin/repository.ts';

async function apiReply(t, status, body, contentType = 'text/html') {
  const originalWindow = globalThis.window, originalFetch = globalThis.fetch;
  globalThis.window = { setTimeout, clearTimeout };
  globalThis.fetch = async () => new Response(body, { status, headers: { 'Content-Type': contentType } });
  t.after(() => { globalThis.fetch = originalFetch; if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });
}

test('missing admin API keeps HTTP404 and gives connection guidance for a static host HTML page', async t => {
  await apiReply(t, 404, '<!doctype html><title>GitHub Pages</title>');
  await assert.rejects(createApiAdminAdapter().session(), e => e.code === '404' && /서버.*주소|연결 설정/.test(e.message) && !/JSON|doctype|GitHub/.test(e.message));
});

test('HTML and empty upstream errors remain HTTP failures rather than malformed-data errors', async t => {
  const originalWindow = globalThis.window, originalFetch = globalThis.fetch;
  globalThis.window = { setTimeout, clearTimeout };
  t.after(() => { globalThis.fetch = originalFetch; if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });
  for (const [status, body] of [[500, '<html>proxy error</html>'], [502, 'Bad Gateway'], [503, '']]) {
    globalThis.fetch = async () => new Response(body, { status });
    await assert.rejects(createApiAdminAdapter().session(), e => e.code === String(status) && /잠시 후/.test(e.message) && !/JSON|proxy|Gateway/.test(e.message));
  }
});

test('successful non-JSON response is rejected without exposing parser or HTML details', async t => {
  await apiReply(t, 200, '<html>login redirect</html>');
  await assert.rejects(createApiAdminAdapter().session(), e => e.code === 'INVALID_RESPONSE' && /자료를 읽지 못/.test(e.message) && !/JSON|html|Unexpected/.test(e.message));
});

test('structured business errors keep their conflict code and useful server message', async t => {
  await apiReply(t, 409, JSON.stringify({ error: { code: 'REVISION_CONFLICT', message: '새 버전을 확인해 주세요.' } }), 'application/json');
  await assert.rejects(createApiAdminAdapter().session(), e => e.code === 'REVISION_CONFLICT' && e.message === '새 버전을 확인해 주세요.');
});

test('malformed error field values cannot become an object displayed in the interface', async t => {
  await apiReply(t, 400, JSON.stringify({ error: { code: {}, message: { private: 'not a user message' } } }), 'application/json');
  await assert.rejects(createApiAdminAdapter().session(), e => e.code === '400' && typeof e.message === 'string' && !e.message.includes('private'));
});

test('authentication and permission failures revoke access before attempting body parsing', async t => {
  const originalWindow = globalThis.window, originalFetch = globalThis.fetch;
  globalThis.window = { setTimeout, clearTimeout };
  t.after(() => { globalThis.fetch = originalFetch; if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });
  for (const status of [401, 403]) {
    let revoked = 0, bodyRead = false;
    globalThis.fetch = async () => ({ status, ok: false, text: async () => { bodyRead = true; throw new Error('must not read unauthorized body'); } });
    await assert.rejects(createApiAdminAdapter(() => revoked++).session(), e => e.code === String(status));
    assert.equal(revoked, 1); assert.equal(bodyRead, false);
  }
});

test('valid server session remains required; valid JSON with invalid membership does not grant access', async t => {
  await apiReply(t, 200, JSON.stringify({ operatorId: 'admin-verified', name: '서버 확인 운영자', role: 'OPERATOR' }), 'application/json');
  assert.equal((await createApiAdminAdapter().session()).operatorId, 'admin-verified');
  globalThis.fetch = async () => new Response(JSON.stringify({ role: 'ADMIN' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  let revoked = 0;
  await assert.rejects(createApiAdminAdapter(() => revoked++).session(), e => e.code === '403');
  assert.equal(revoked, 1);
});
