import test from 'node:test';
import assert from 'node:assert/strict';
import { readSavedCourses, savedCourseStorageKey, toggleSavedCourse } from '../src/savedCourseStore.ts';

function memory() {
  const values = new Map(), reads = [], writes = [];
  return { values, reads, writes, getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { writes.push(key); values.set(key, value); } };
}

test('guest, guest-like names and current account read only their own keys', () => {
  const storage = memory(), owners = ['', 'guest', 'guest-device', 'account:guest', 'a/b', 'a%2Fb'];
  assert.equal(new Set(owners.map(savedCourseStorageKey)).size, owners.length);
  owners.forEach((owner, index) => toggleSavedCourse(storage, owner, `course-${index}`, true));
  for (const [index, owner] of owners.entries()) {
    const previousCount = storage.reads.length;
    assert.deepEqual(readSavedCourses(storage, owner).ids, [`course-${index}`]);
    assert.deepEqual(storage.reads.slice(previousCount), [savedCourseStorageKey(owner)]);
  }
});

test('saved references reload newest first without importing another course field', () => {
  const storage = memory();
  toggleSavedCourse(storage, 'me', 'a', true);
  const result = toggleSavedCourse(storage, 'me', 'b', true);
  result.ids.push('not-persisted');
  assert.deepEqual(readSavedCourses(storage, 'me'), { status: 'ready', ids: ['b', 'a'], message: '' });
  assert.deepEqual(JSON.parse(storage.values.get(savedCourseStorageKey('me'))), { schemaVersion: 1, owner: 'me', ids: ['b', 'a'] });
});

test('only current public sources can be added; unavailable saved references can be removed', () => {
  const storage = memory();
  assert.throws(() => toggleSavedCourse(storage, 'me', 'withdrawn', false), /현재 볼 수 있는/);
  assert.equal(storage.writes.length, 0);
  toggleSavedCourse(storage, 'me', 'used-to-be-public', true);
  assert.deepEqual(toggleSavedCourse(storage, 'me', 'used-to-be-public', false).ids, []);
});

test('updates merge fresh references and explicit stale save/removal does not toggle twice', () => {
  const storage = memory();
  const a = readSavedCourses(storage, 'me'), b = readSavedCourses(storage, 'me');
  toggleSavedCourse(storage, 'me', 'a', true, !a.ids.includes('a'));
  toggleSavedCourse(storage, 'me', 'b', true, !b.ids.includes('b'));
  assert.deepEqual(toggleSavedCourse(storage, 'me', 'a', true, !b.ids.includes('a')).ids, ['b', 'a']);
  assert.equal(storage.writes.length, 2);
  toggleSavedCourse(storage, 'me', 'a', true, false);
  assert.deepEqual(toggleSavedCourse(storage, 'me', 'a', true, false).ids, ['b']);
  assert.equal(storage.writes.length, 3);
});

test('malformed, foreign, duplicate, extra-field and future data are never read or overwritten', () => {
  const make = (patch = {}) => JSON.stringify({ schemaVersion: 1, owner: 'me', ids: ['public'], ...patch });
  for (const raw of ['broken {', make({ owner: 'another' }), make({ schemaVersion: 2 }), make({ ids: ['same', 'same'] }),
    make({ ids: [' bad '] }), make({ ids: ['\ud800'] }), make({ privateNote: 'private' }), 'x'.repeat(128_001)]) {
    const storage = memory(), key = savedCourseStorageKey('me');
    storage.values.set(key, raw);
    const read = readSavedCourses(storage, 'me');
    assert.equal(read.status, 'invalid');
    assert.deepEqual(read.ids, []);
    assert.throws(() => toggleSavedCourse(storage, 'me', 'another-course', true));
    assert.equal(storage.values.get(key), raw);
    assert.equal(storage.writes.length, 0);
  }
});

test('the bookmark limit preserves order and data; removing a reference frees space', () => {
  const storage = memory(), key = savedCourseStorageKey('me');
  const ids = Array.from({ length: 200 }, (_, index) => `course-${index}`);
  storage.values.set(key, JSON.stringify({ schemaVersion: 1, owner: 'me', ids }));
  assert.throws(() => toggleSavedCourse(storage, 'me', 'new', true), /200개/);
  assert.equal(storage.writes.length, 0);
  assert.deepEqual(readSavedCourses(storage, 'me').ids, ids);
  toggleSavedCourse(storage, 'me', ids.at(-1), false);
  assert.deepEqual(toggleSavedCourse(storage, 'me', 'new', true).ids, ['new', ...ids.slice(0, -1)]);
});

test('denied and unavailable storage cannot silently claim that a bookmark was saved', () => {
  const storage = memory();
  toggleSavedCourse(storage, 'me', 'original', true);
  const deniedRead = { getItem: () => { throw new Error('denied'); }, setItem: () => assert.fail('must not write') };
  assert.equal(readSavedCourses(null, 'me').status, 'unavailable');
  assert.equal(readSavedCourses(deniedRead, 'me').status, 'unavailable');
  assert.throws(() => toggleSavedCourse(deniedRead, 'me', 'a', true));
  const deniedWrite = { getItem: key => storage.getItem(key), setItem: () => { throw new Error('quota'); } };
  assert.throws(() => toggleSavedCourse(deniedWrite, 'me', 'a', true), /바꾸지 못했어요/);
  assert.deepEqual(readSavedCourses(storage, 'me').ids, ['original']);
  assert.equal(readSavedCourses(storage, ' me ').status, 'unavailable');
  assert.throws(() => savedCourseStorageKey('\ud800'));
});
