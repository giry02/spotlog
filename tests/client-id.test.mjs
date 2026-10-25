import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createClientId } from '../lib/client-id.ts';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('secure contexts retain the native UUID method and its receiver', () => {
  const expected = '6b2222f7-8e60-44db-951a-a543b4394c5b';
  const cryptoApi = {
    randomUUID() { assert.equal(this, cryptoApi); return expected; },
    getRandomValues() { assert.fail('native UUID must not request fallback bytes'); },
  };
  assert.equal(createClientId(cryptoApi), expected);
});

test('LAN HTTP contexts use cryptographic bytes and enforce UUID version and variant', () => {
  for (const fill of [0, 255]) {
    let requests = 0;
    const cryptoApi = {
      getRandomValues(bytes) {
        assert.equal(this, cryptoApi);
        assert.equal(bytes.length, 16);
        requests++;
        return bytes.fill(fill);
      },
    };
    const id = createClientId(cryptoApi);
    assert.match(id, uuidV4);
    assert.equal(id, fill ? 'ffffffff-ffff-4fff-bfff-ffffffffffff' : '00000000-0000-4000-8000-000000000000');
    assert.equal(requests, 1);
  }
});

test('fallback produces independent valid request and comment UUIDs', () => {
  const insecureCrypto = { getRandomValues: bytes => webcrypto.getRandomValues(bytes) };
  const ids = Array.from({ length: 128 }, () => createClientId(insecureCrypto));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, uuidV4);
  assert.match(`comment-${ids[0]}`, /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/);
});

test('missing cryptographic randomness fails clearly without inventing weak IDs', () => {
  assert.throws(() => createClientId({}), /안전한 요청 번호/);
  assert.throws(() => createClientId({ getRandomValues() { throw new Error('crypto blocked'); } }), /crypto blocked/);
});
