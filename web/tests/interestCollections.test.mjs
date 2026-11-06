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

test('saved-place search intersects folder, region and kind rather than widening any selected scope', () => {
  const saved = [
    { id: 'a', kind: 'CAFE', name: '바다 커피', area: '부산 해운대', address: '부산광역시 해운대구 달맞이길 12' },
    { id: 'b', kind: 'FOOD', name: '바다 식당', area: '부산 해운대', address: '부산광역시 해운대구 달맞이길 12' },
    { id: 'c', kind: 'CAFE', name: '바다 커피', area: '제주 애월', address: '제주특별자치도 애월읍' },
    { id: 'outside', kind: 'CAFE', name: '바다 커피', area: '부산 해운대', address: '부산광역시 해운대구 달맞이길 12' },
  ];
  const collection = setInterestCollectionPlaces(folder(), 'folder-1', ['a', 'b', 'c'], saved).collections[0];
  assert.deepEqual(filterInterestPlaces(saved, collection, '부산', 'CAFE', '바다 달맞이길 12').map(place => place.id), ['a']);
  assert.deepEqual(filterInterestPlaces(saved, collection, '부산', 'CAFE', '애월'), []);
  assert.deepEqual(filterInterestPlaces(saved, collection, '부산', 'CAFE', '없는 장소'), []);
});

test('name and address queries normalize Unicode/case, match literal words and ignore descriptions', () => {
  const saved = [{ id: 'cafe', kind: 'CAFE', name: 'Café [바다]', area: '부산 수영', address: '수영로 123', description: '비밀검색태그' }];
  assert.equal(filterInterestPlaces(saved, undefined, '', '', '  ＣＡＦＥ\u0301  123 ').length, 1);
  assert.equal(filterInterestPlaces(saved, undefined, '', '', '[바다]').length, 1);
  assert.equal(filterInterestPlaces(saved, undefined, '', '', '.*').length, 0, 'query is literal, not a regular expression');
  assert.equal(filterInterestPlaces(saved, undefined, '', '', '비밀검색태그').length, 0);
});

test('clearing only search retains folder/region/kind and never changes stored folders or saved inputs', () => {
  const state = setInterestCollectionPlaces(folder(), 'folder-1', ['food', 'cafe', 'stay'], places);
  const storage = memory(); writeInterestCollections(storage, state, 0);
  const originalBytes = [...storage.values], before = structuredClone(state), beforePlaces = structuredClone(places);
  assert.deepEqual(filterInterestPlaces(places, state.collections[0], '부산', 'CAFE', '불일치'), []);
  assert.deepEqual(filterInterestPlaces(places, state.collections[0], '부산', 'CAFE', '  \t ').map(place => place.id), ['cafe']);
  assert.deepEqual(state, before); assert.deepEqual(places, beforePlaces); assert.deepEqual([...storage.values], originalBytes);
});

test('search follows current saved inputs after removal and does not resurrect a removed folder reference', () => {
  const state = setInterestCollectionPlaces(folder(), 'folder-1', ['food', 'cafe'], places), collection = state.collections[0];
  assert.deepEqual(filterInterestPlaces(places, collection, '', '', '카페').map(place => place.id), ['cafe']);
  assert.deepEqual(filterInterestPlaces(places.filter(place => place.id !== 'cafe'), collection, '', '', '카페'), []);
  assert.deepEqual(collection.placeIds, ['food', 'cafe']);
  assert.deepEqual(filterInterestPlaces(places, undefined, '', '', '').map(place => place.id), places.map(place => place.id));
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
