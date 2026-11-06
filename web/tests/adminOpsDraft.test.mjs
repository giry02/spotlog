import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewDraftKey, readReviewDraft, writeReviewDraft, clearReviewDraft } from '../src/admin/useReviewDraft.ts';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};

test('administrator draft survives recreation and stays separated by principal, editor and target', () => {
  const cache = storage(), key = reviewDraftKey('operator-a', 'inquiry', 'inquiry-1');
  const initial = { reply: '', entityRevision: 1 }, unfinished = { reply: '아직 확인 중인 답변', entityRevision: 1 };
  assert.equal(writeReviewDraft('LOCAL', key, unfinished, cache), true);
  assert.deepEqual(readReviewDraft('LOCAL', key, initial, cache), unfinished);
  for (const distinct of [reviewDraftKey('operator-b', 'inquiry', 'inquiry-1'), reviewDraftKey('operator-a', 'translation', 'inquiry-1'), reviewDraftKey('operator-a', 'inquiry', 'inquiry-2')]) assert.deepEqual(readReviewDraft('LOCAL', distinct, initial, cache), initial);
  assert.notEqual(reviewDraftKey('a:b', 'c', 'd'), reviewDraftKey('a', 'b:c', 'd'));
});

test('API mode never reads, writes or clears local original text', () => {
  let calls = 0; const forbidden = { getItem() { calls++; throw new Error('Unexpected read'); }, setItem() { calls++; }, removeItem() { calls++; } };
  const initial = { original: '서비스 메모리에서만 사용하는 원문' };
  assert.equal(readReviewDraft('API', 'key', initial, forbidden), initial);
  assert.equal(writeReviewDraft('API', 'key', initial, forbidden), false);
  clearReviewDraft('API', 'key', forbidden);
  assert.equal(readReviewDraft(undefined, 'key', initial, forbidden), initial);
  assert.equal(calls, 0);
});

test('successful clear removes only its own draft and conflict retains old revision and unfinished text', () => {
  const cache = storage(), first = reviewDraftKey('a', 'exposure', 'one'), second = reviewDraftKey('a', 'exposure', 'two');
  writeReviewDraft('LOCAL', first, { title: '미완료', revision: 1 }, cache);
  writeReviewDraft('LOCAL', second, { title: '다른 초안', revision: 1 }, cache);
  // A newer server record does not silently rewrite the draft's comparison revision.
  assert.deepEqual(readReviewDraft('LOCAL', first, { title: '서버 최신', revision: 2 }, cache), { title: '미완료', revision: 1 });
  clearReviewDraft('LOCAL', first, cache);
  assert.equal(readReviewDraft('LOCAL', first, 'cleared', cache), 'cleared');
  assert.deepEqual(readReviewDraft('LOCAL', second, { title: '', revision: 1 }, cache), { title: '다른 초안', revision: 1 });
});

test('corrupted, incompatible or wrong-schema cache safely restores current initial values', () => {
  const cache = storage(), initial = { title: '', revision: 1 };
  for (const value of ['not json', JSON.stringify({ schemaVersion: 2, value: initial }), JSON.stringify({ schemaVersion: 1, value: { title: 42, revision: 1 } })]) {
    cache.setItem('key', value); assert.equal(readReviewDraft('LOCAL', 'key', initial, cache), initial);
  }
  const unavailable = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Quota'); }, removeItem() { throw new Error('Blocked'); } };
  assert.equal(readReviewDraft('LOCAL', 'key', initial, unavailable), initial);
  assert.equal(writeReviewDraft('LOCAL', 'key', initial, unavailable), false);
  assert.doesNotThrow(() => clearReviewDraft('LOCAL', 'key', unavailable));
});
