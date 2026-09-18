import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalRepository, LIBRARY_KEY, MIGRATION_BACKUP_KEY, REPOSITORY_KEY, RESTORE_BACKUP_KEY } from '../src/localRepository.ts';

class FakeStorage {
  data = new Map();
  failKey = null;
  readsBlocked = false;
  writes = [];
  constructor(initial = {}) { Object.entries(initial).forEach(([key, value]) => this.data.set(key, value)); }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { if (this.readsBlocked) throw new DOMException('Denied', 'SecurityError'); return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.failKey === key) throw new DOMException('Full', 'QuotaExceededError'); this.writes.push(key); this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

const savedKey = 'spotlog.web.saved.v3';
const library = { collections: [{ id: 'weekend', name: '주말에 가고 싶은 곳', placeIds: ['seoul-forest'] }], notes: { 'seoul-forest': '해 질 무렵 산책' } };

test('collection schedule links survive reload and backup without changing legacy collections', () => {
  const storage = new FakeStorage({ [LIBRARY_KEY]: JSON.stringify(library) });
  const repository = createLocalRepository(storage);
  assert.deepEqual(JSON.parse(repository.getItem(LIBRARY_KEY)), library);
  const linked = { ...library, collections: [{ ...library.collections[0], linkedJourneyId: 'weekend-trip' }] };
  assert.equal(repository.setItem(LIBRARY_KEY, JSON.stringify(linked)), true);
  assert.deepEqual(JSON.parse(createLocalRepository(storage).getItem(LIBRARY_KEY)), linked);
  const restored = createLocalRepository(new FakeStorage());
  assert.equal(restored.restoreBackup(repository.exportBackup()), true);
  assert.deepEqual(JSON.parse(restored.getItem(LIBRARY_KEY)), linked);
});

test('malformed collection schedule links cannot overwrite the saved library', () => {
  const storage = new FakeStorage({ [LIBRARY_KEY]: JSON.stringify(library) });
  const repository = createLocalRepository(storage);
  const previous = storage.getItem(REPOSITORY_KEY);
  assert.equal(repository.setItem(LIBRARY_KEY, JSON.stringify({ ...library, collections: [{ ...library.collections[0], linkedJourneyId: 2 }] })), false);
  assert.equal(storage.getItem(REPOSITORY_KEY), previous);
});

test('schedule creation and collection link are atomic even when storage is full', () => {
  const journeyKey = 'spotlog.web.journeys.v4';
  const storage = new FakeStorage({ [LIBRARY_KEY]: JSON.stringify(library), [journeyKey]: '[]' });
  const repository = createLocalRepository(storage);
  const journey = { id: 'weekend-trip', title: '주말', region: '서울', dateRange: '날짜 미정', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '/cover.jpg', summary: '', story: '', author: '나', isMine: true, saves: 0, tags: [], days: [1, 2].map(day => ({ day, date: `DAY ${day}`, title: `${day}일차`, story: '', places: [], blocks: [] })) };
  const linked = { ...library, collections: [{ ...library.collections[0], linkedJourneyId: journey.id }] };
  const changes = { [journeyKey]: JSON.stringify([journey]), [LIBRARY_KEY]: JSON.stringify(linked) };
  const previous = storage.getItem(REPOSITORY_KEY);
  storage.failKey = REPOSITORY_KEY;
  assert.equal(repository.setItems(changes), false);
  assert.equal(storage.getItem(REPOSITORY_KEY), previous);
  assert.equal(repository.getItem(journeyKey), '[]');
  assert.deepEqual(JSON.parse(repository.getItem(LIBRARY_KEY)), library);
  storage.failKey = null;
  const count = storage.writes.length;
  assert.equal(repository.setItems(changes), true);
  assert.equal(storage.writes.length, count + 1);
  const next = createLocalRepository(storage);
  assert.deepEqual(JSON.parse(next.getItem(journeyKey)), [journey]);
  assert.deepEqual(JSON.parse(next.getItem(LIBRARY_KEY)), linked);
});

test('migration first snapshots raw legacy records and leaves originals untouched', () => {
  const original = '["seoul-forest", "jeju-hyeopjae"]';
  const storage = new FakeStorage({ [savedKey]: original });
  const repository = createLocalRepository(storage);
  assert.equal(repository.getItem(savedKey), original);
  assert.equal(repository.getIssue(), null);
  assert.deepEqual(storage.writes, [MIGRATION_BACKUP_KEY, REPOSITORY_KEY]);
  assert.equal(JSON.parse(storage.getItem(MIGRATION_BACKUP_KEY)).records[savedKey], original);
  assert.equal(storage.getItem(savedKey), original);
});

test('write and reload preserve collections, notes, and other records', () => {
  const storage = new FakeStorage({ [savedKey]: '["seoul-forest"]' });
  const repository = createLocalRepository(storage);
  assert.equal(repository.setItem(LIBRARY_KEY, JSON.stringify(library)), true);
  const next = createLocalRepository(storage);
  assert.deepEqual(JSON.parse(next.getItem(LIBRARY_KEY)), library);
  assert.equal(next.getItem(savedKey), '["seoul-forest"]');
  assert.equal(storage.getItem(savedKey), '["seoul-forest"]');
});

test('malformed legacy JSON never gets silently replaced by seeded defaults', () => {
  const corrupt = '["seoul-forest",';
  const storage = new FakeStorage({ [savedKey]: corrupt });
  const repository = createLocalRepository(storage);
  assert.match(repository.getIssue(), /원본/);
  assert.equal(repository.getItem(savedKey), null);
  assert.equal(repository.setItem(savedKey, '[]'), false);
  assert.equal(storage.getItem(savedKey), corrupt);
  assert.equal(storage.getItem(REPOSITORY_KEY), null);
  assert.equal(JSON.parse(repository.exportBackup()).records[savedKey], corrupt);
});

test('valid JSON with invalid shape is protected like malformed JSON', () => {
  const storage = new FakeStorage({ [savedKey]: '{"unexpected":"record"}' });
  const repository = createLocalRepository(storage);
  assert.equal(repository.setItem(savedKey, '[]'), false);
  assert.equal(storage.writes.length, 0);
});

test('malformed schema envelope is retained for manual recovery', () => {
  const corrupt = '{"schemaVersion":2,"records":';
  const storage = new FakeStorage({ [REPOSITORY_KEY]: corrupt });
  const repository = createLocalRepository(storage);
  assert.equal(repository.setItem(savedKey, '[]'), false);
  assert.equal(storage.getItem(REPOSITORY_KEY), corrupt);
  assert.equal(JSON.parse(repository.exportBackup()).recoverySource, corrupt);
});

test('migration snapshot failure prevents an authoritative schema write', () => {
  const storage = new FakeStorage({ [savedKey]: '["old"]' });
  storage.failKey = MIGRATION_BACKUP_KEY;
  const repository = createLocalRepository(storage);
  assert.match(repository.getIssue(), /저장 공간/);
  assert.equal(repository.getItem(savedKey), '["old"]');
  assert.equal(repository.setItem(savedKey, '[]'), false);
  assert.equal(storage.getItem(REPOSITORY_KEY), null);
});

test('quota failure reports unsaved changes and preserves last successful state', () => {
  const storage = new FakeStorage({ [savedKey]: '["old"]' });
  const repository = createLocalRepository(storage);
  const previous = storage.getItem(REPOSITORY_KEY);
  storage.failKey = REPOSITORY_KEY;
  assert.equal(repository.setItem(savedKey, '["new"]'), false);
  assert.match(repository.getIssue(), /저장 공간/);
  assert.equal(storage.getItem(REPOSITORY_KEY), previous);
  assert.equal(repository.getItem(savedKey), '["old"]');
  storage.failKey = null;
  assert.equal(repository.setItem(savedKey, '["new"]'), true);
  assert.equal(repository.getIssue(), null);
});

test('storage security failure is recoverable without a crash', () => {
  const storage = new FakeStorage();
  storage.readsBlocked = true;
  const repository = createLocalRepository(storage);
  assert.equal(repository.getItem(savedKey), null);
  assert.equal(repository.setItem(savedKey, '[]'), false);
  assert.match(repository.getIssue(), /접근/);
  assert.doesNotThrow(() => JSON.parse(repository.exportBackup()));
});

test('separate tabs merge changes to different records', () => {
  const storage = new FakeStorage();
  const first = createLocalRepository(storage);
  const second = createLocalRepository(storage);
  first.setItem(savedKey, '["new"]');
  second.setItem(LIBRARY_KEY, JSON.stringify(library));
  const reloaded = createLocalRepository(storage);
  assert.equal(reloaded.getItem(savedKey), '["new"]');
  assert.deepEqual(JSON.parse(reloaded.getItem(LIBRARY_KEY)), library);
});

test('invalid values or backups cannot replace existing data', () => {
  const storage = new FakeStorage({ [savedKey]: '["old"]' });
  const repository = createLocalRepository(storage);
  const original = storage.getItem(REPOSITORY_KEY);
  assert.equal(repository.setItem(savedKey, '[7]'), false);
  assert.equal(repository.setItem('other-app', '{}'), false);
  assert.equal(repository.restoreBackup('{}'), false);
  assert.equal(repository.restoreBackup('bad json'), false);
  assert.equal(storage.getItem(REPOSITORY_KEY), original);
});

test('a validated backup restores after corruption and snapshots the damaged original', () => {
  const source = createLocalRepository(new FakeStorage({ [savedKey]: '["recovered"]' }));
  const storage = new FakeStorage({ [REPOSITORY_KEY]: 'damaged' });
  const target = createLocalRepository(storage);
  assert.equal(target.restoreBackup(source.exportBackup()), true);
  assert.equal(target.getItem(savedKey), '["recovered"]');
  assert.equal(target.getIssue(), null);
  assert.equal(JSON.parse(storage.getItem(RESTORE_BACKUP_KEY)).recoverySource, 'damaged');
  assert.equal(target.setItem(savedKey, '["recovered", "another"]'), true);
});

test('failed restore snapshot leaves previous data intact', () => {
  const source = createLocalRepository(new FakeStorage({ [savedKey]: '["replacement"]' }));
  const storage = new FakeStorage({ [savedKey]: '["original"]' });
  const target = createLocalRepository(storage);
  const original = storage.getItem(REPOSITORY_KEY);
  storage.failKey = RESTORE_BACKUP_KEY;
  assert.equal(target.restoreBackup(source.exportBackup()), false);
  assert.equal(storage.getItem(REPOSITORY_KEY), original);
  assert.equal(target.getItem(savedKey), '["original"]');
});

test('collection IDs must be unique and notes must be text', () => {
  const repository = createLocalRepository(new FakeStorage());
  assert.equal(repository.setItem(LIBRARY_KEY, JSON.stringify({ collections: [...library.collections, ...library.collections], notes: {} })), false);
  assert.equal(repository.setItem(LIBRARY_KEY, JSON.stringify({ collections: [], notes: { x: 3 } })), false);
});

test('saved places and collection membership are committed in one envelope write', () => {
  const storage = new FakeStorage({ [savedKey]: '["seoul-forest"]', [LIBRARY_KEY]: JSON.stringify(library) });
  const repository = createLocalRepository(storage);
  const writeCount = storage.writes.length;
  const removed = { collections: [{ ...library.collections[0], placeIds: [] }], notes: {} };
  assert.equal(repository.setItems({ [savedKey]: '[]', [LIBRARY_KEY]: JSON.stringify(removed) }), true);
  assert.equal(storage.writes.length, writeCount + 1);
  const next = createLocalRepository(storage);
  assert.equal(next.getItem(savedKey), '[]');
  assert.deepEqual(JSON.parse(next.getItem(LIBRARY_KEY)), removed);
});

test('an invalid member or storage failure rejects the complete multi-record update', () => {
  const storage = new FakeStorage({ [savedKey]: '["seoul-forest"]', [LIBRARY_KEY]: JSON.stringify(library) });
  const repository = createLocalRepository(storage);
  const original = storage.getItem(REPOSITORY_KEY);
  assert.equal(repository.setItems({ [savedKey]: '[]', [LIBRARY_KEY]: '{}' }), false);
  assert.equal(storage.getItem(REPOSITORY_KEY), original);
  storage.failKey = REPOSITORY_KEY;
  assert.equal(repository.setItems({ [savedKey]: '[]', [LIBRARY_KEY]: JSON.stringify({ collections: [], notes: {} }) }), false);
  assert.equal(storage.getItem(REPOSITORY_KEY), original);
  assert.equal(repository.getItem(savedKey), '["seoul-forest"]');
  assert.deepEqual(JSON.parse(repository.getItem(LIBRARY_KEY)), library);
});

test('unchanged data avoids redundant writes and unknown reads return null', () => {
  const storage = new FakeStorage({ [savedKey]: '["old"]' });
  const repository = createLocalRepository(storage);
  const writeCount = storage.writes.length;
  assert.equal(repository.setItem(savedKey, '["old"]'), true);
  assert.equal(storage.writes.length, writeCount);
  assert.equal(repository.getItem('__proto__'), null);
});

test('backup download includes the latest committed changes from other tabs', () => {
  const storage = new FakeStorage();
  const first = createLocalRepository(storage);
  const second = createLocalRepository(storage);
  second.setItems({ [savedKey]: '["latest"]', [LIBRARY_KEY]: JSON.stringify(library) });
  const backup = JSON.parse(first.exportBackup());
  assert.equal(backup.records[savedKey], '["latest"]');
  assert.deepEqual(JSON.parse(backup.records[LIBRARY_KEY]), library);
});
