import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterestCollection, emptyInterestCollections, filterInterestPlaces, interestPlaceRegion, interestStorageKey, readInterestCollections, removeInterestCollection, renameInterestCollection, setInterestCollectionPlaces, writeInterestCollections } from '../src/interestCollectionStore.ts';

const memory = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const places = [
  { id: 'food', kind: 'FOOD', name: '식당', area: '부산 해운대', address: '부산광역시 해운대구' },
  { id: 'cafe', kind: 'CAFE', name: '카페', area: '부산 수영', address: '부산광역시 수영구' },
  { id: 'stay', kind: 'STAY', name: '숙소', area: '제주시 한림읍', address: '제주특별자치도 제주시' },
];
const folder = (owner = 'member-a') => createInterestCollection(emptyInterestCollections(owner), '부산 가족여행', '부산', 'folder-1', '2026-10-28T00:00:00.000Z');

test('account namespaces and guest device namespace never share stored folders', () => {
  const storage = memory();
  writeInterestCollections(storage, folder(), 0);
  assert.equal(readInterestCollections(storage, 'member-a').state.collections.length, 1);
  assert.equal(readInterestCollections(storage, 'member-b').state.collections.length, 0);
  assert.equal(readInterestCollections(storage, 'guest-device').state.collections.length, 0);
  assert.notEqual(interestStorageKey('a:b'), interestStorageKey('a%3Ab'));
  assert.throws(() => interestStorageKey(' '));
});

test('malformed, foreign-owner and unknown-version records are preserved and cannot be overwritten', () => {
  for (const raw of ['{broken', JSON.stringify({ ...folder(), owner: 'member-b' }), JSON.stringify({ ...folder(), schemaVersion: 2 }), JSON.stringify({ ...folder(), collections: [{ ...folder().collections[0], placeIds: ['food', 'food'] }] })]) {
    const storage = memory(); storage.setItem(interestStorageKey('member-a'), raw);
    assert.equal(readInterestCollections(storage, 'member-a').status, 'invalid');
    assert.throws(() => writeInterestCollections(storage, folder(), 0));
    assert.equal(storage.getItem(interestStorageKey('member-a')), raw);
  }
});

test('failed write and stale revision preserve previous folders', () => {
  const storage = memory();
  const initial = writeInterestCollections(storage, folder(), 0);
  const previous = storage.getItem(interestStorageKey('member-a'));
  assert.throws(() => writeInterestCollections(storage, renameInterestCollection(initial, 'folder-1', '변경'), 0), /다른 화면/);
  assert.equal(storage.getItem(interestStorageKey('member-a')), previous);
  const blocked = { getItem: storage.getItem, setItem() { throw new Error('QuotaExceededError'); } };
  assert.throws(() => writeInterestCollections(blocked, renameInterestCollection(initial, 'folder-1', '변경'), 1), /기존 목록은 유지/);
  assert.equal(storage.getItem(interestStorageKey('member-a')), previous);
});

test('same saved restaurant may appear in multiple folders; deleting a folder leaves other folders and input untouched', () => {
  let state = folder();
  state = createInterestCollection(state, '친구 맛집', '', 'folder-2');
  state = setInterestCollectionPlaces(state, 'folder-1', ['food', 'cafe'], places);
  state = setInterestCollectionPlaces(state, 'folder-2', ['food'], places);
  const previous = structuredClone(state);
  const next = removeInterestCollection(state, 'folder-1');
  assert.deepEqual(next.collections[0].placeIds, ['food']);
  assert.deepEqual(state, previous);
  assert.equal(places.length, 3);
  assert.throws(() => setInterestCollectionPlaces(state, 'folder-2', ['not-saved'], places));
});

test('regional and kind filters include food/café/stay without requiring landmarks', () => {
  const state = setInterestCollectionPlaces(folder(), 'folder-1', places.map(place => place.id), places);
  assert.deepEqual(filterInterestPlaces(places, state.collections[0], '부산').map(place => place.id), ['food', 'cafe']);
  assert.deepEqual(filterInterestPlaces(places, undefined, '', 'STAY').map(place => place.id), ['stay']);
  assert.deepEqual(filterInterestPlaces(places, state.collections[0], '부산', 'CAFE').map(place => place.id), ['cafe']);
  assert.equal(interestPlaceRegion(places[2]), '제주');
  assert.equal(interestPlaceRegion({ area: '부산광역시 해운대구', address: '' }), '부산');
});

test('temporary unsaved references are retained without reintroducing favorites or changing trips', () => {
  const state = setInterestCollectionPlaces(folder(), 'folder-1', ['food', 'cafe'], places);
  const next = setInterestCollectionPlaces(state, 'folder-1', [], [places[0]]);
  assert.deepEqual(next.collections[0].placeIds, ['cafe']);
  assert.deepEqual(filterInterestPlaces([places[0]], next.collections[0]), []);
  assert.deepEqual(filterInterestPlaces(places, next.collections[0]).map(place => place.id), ['cafe']);
});

test('folder validation rejects unusable names without changing prior state', () => {
  const state = folder(); const previous = structuredClone(state);
  assert.throws(() => createInterestCollection(state, '  '));
  assert.throws(() => createInterestCollection(state, 'a'.repeat(81)));
  assert.throws(() => renameInterestCollection(state, 'missing', '이름'));
  assert.deepEqual(state, previous);
  assert.equal(readInterestCollections(null, 'member-a').status, 'unavailable');
});
