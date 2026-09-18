import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSavedTravelDraft } from '../src/aiTravelDraft.ts';
import { selectAiTravelVisits, aiTravelVisitKey } from '../src/aiTravelSelection.ts';
import { createLocalRepository } from '../src/localRepository.ts';

const place = { id: 'saved-a', kind: 'LANDMARK', name: '저장한 장소', area: '제주 한림', address: '', lat: 33.39, lng: 126.24, image: '/a.jpg', description: '장소 설명', note: '내 메모', duration: '1시간', tags: ['해변'], photos: [{ mediaId: 'photo-a', placeId: 'saved-a', sourceId: 'source-a', image: '/a.jpg', alt: '첫 사진', caption: '사진 설명' }] };

test('one saved place retains 1, 2 and 7 DAYs, with no invented dates or extra places', () => {
  for (const count of [1, 2, 7]) {
    const result = buildSavedTravelDraft([place], count);
    assert.deepEqual(result.errors, []);
    assert.equal(result.journey.days.length, count);
    assert.deepEqual(result.sourcePlaceIds, [place.id]);
    assert.equal(result.journey.days.at(-1).date, `DAY ${count}`);
    assert.equal(result.journey.days.slice(1).flatMap(day => day.places).length, 0);
    assert.equal(result.journey.visibility, 'PRIVATE');
    assert.equal(result.journey.days[0].places[0].time, undefined);
  }
});
test('saved-only generation retains selected kinds/regions, independent metadata and distinct visit IDs', () => {
  const sources = [place, { ...place, id: 'saved-b', photos: [], area: '서울 성동', kind: 'STAY', lat: null, lng: null }, place];
  const before = structuredClone(sources);
  const first = buildSavedTravelDraft(sources, 2);
  const second = buildSavedTravelDraft(sources, 2);
  assert.deepEqual(first.sourcePlaceIds, ['saved-a', 'saved-b']);
  assert.notEqual(first.journey.id, second.journey.id);
  const visits = first.journey.days.flatMap(day => day.places);
  assert.equal(new Set(visits.map(visit => visit.visitId)).size, 2);
  visits[0].photos[0].caption = '초안 변경';
  visits[0].tags.push('추가');
  assert.deepEqual(sources, before);
});
test('invalid periods and empty selections cannot generate a savable draft', () => {
  for (const days of [0, 8, 1.5, NaN]) assert.equal(buildSavedTravelDraft([place], days).journey, null);
  assert.equal(buildSavedTravelDraft([], 2).journey, null);
});
test('preview exclusions preserve DAYs and source; restored backup retains per-photo identity/credits', () => {
  const preview = buildSavedTravelDraft([place], 7).journey;
  const chosen = selectAiTravelVisits(preview, new Set([aiTravelVisitKey(1, preview.days[0].places[0], 0)]));
  assert.equal(chosen.days.length, 7);
  assert.equal(chosen.days.flatMap(day => day.places).length, 0);
  assert.equal(preview.days[0].places.length, 1);
  const map = new Map();
  const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  const repository = createLocalRepository(storage);
  const key = 'spotlog.web.journeys.v4';
  assert.equal(repository.setItem(key, JSON.stringify([preview])), true);
  const backup = repository.exportBackup();
  assert.equal(repository.restoreBackup(backup), true);
  assert.deepEqual(JSON.parse(repository.getItem(key))[0].days[0].places[0].photos, place.photos);
  const before = repository.getItem(key);
  for (const photos of [null, 'invalid', [{ ...place.photos[0], caption: 9 }], [{ ...place.photos[0], placeId: 'other' }]]) {
    const invalid = structuredClone(preview);
    invalid.days[0].places[0].photos = photos;
    assert.equal(repository.setItem(key, JSON.stringify([invalid])), false);
    assert.equal(repository.getItem(key), before);
  }
});
