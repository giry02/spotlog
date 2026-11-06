import test from 'node:test';
import assert from 'node:assert/strict';
import busanRecords from '../src/busanBusinessRecords.json' with { type: 'json' };
import landmarkRecords from '../src/busanLandmarkRecords.json' with { type: 'json' };
import { plannerBusinessPlaces, plannerBusinessSourceById, plannerBusinessEnrichmentSources } from '../src/plannerBusinessCatalog.ts';
import { distanceBetween } from '../src/tripPlan.ts';

const busan = plannerBusinessPlaces.filter(place => place.area.startsWith('부산'));
const nearby = (anchor, kind, radius) => busan.filter(place => place.kind === kind && distanceBetween(anchor, place) <= radius);

test('Busan expansion keeps existing business identities and covers distinct kinds and eleven districts', () => {
  assert.equal(busan.length, 47);
  assert.deepEqual(['FOOD','CAFE','STAY'].map(kind => busan.filter(place => place.kind === kind).length), [25,18,4]);
  assert.equal(new Set(busan.map(place => place.id)).size, busan.length);
  assert.ok(new Set(busan.map(place => place.area)).size >= 11);
  for (const id of ['geumsu','geodae','westin','shilla-stay','paradise','park-hyatt','blackup','momos','bibibidang']) {
    assert.ok(busan.some(place => place.id === `catalog-busan-${id}`), id);
  }
  assert.equal(plannerBusinessPlaces.filter(place => !place.area.startsWith('부산')).length, 18);
});

test('Momos and Blackup branches are not merged or given another branch location', () => {
  const momos = ['momos','momos-yeongdo','momos-domoheon'].map(id => busan.find(place => place.id === `catalog-busan-${id}`));
  assert.deepEqual(momos.map(place => place.area), ['부산 금정','부산 영도','부산 수영']);
  assert.equal(new Set(momos.map(place => place.address)).size, 3);
  const blackup = ['blackup','blackup-saha'].map(id => busan.find(place => place.id === `catalog-busan-${id}`));
  assert.deepEqual(blackup.map(place => place.area), ['부산 부산진','부산 사하']);
  assert.ok(distanceBetween(...blackup) > 10);
  assert.ok(!busan.some(place => place.id === 'catalog-busan-namaste'), 'Official archive coordinates conflict with the Haeundae branch, so it remains excluded');
});

test('Busan summaries and tags describe known categories rather than placeholder rows or invented live facts', () => {
  const evidence = new Map(plannerBusinessEnrichmentSources.map(source => [source.placeId, source]));
  for (const place of busan) {
    assert.ok(place.description.length >= 45, place.name);
    assert.ok(place.description.split(/[.!?]/).filter(value => value.trim()).length >= 2, place.name);
    assert.ok(place.tags.length >= 2, place.name);
    assert.ok(!/평점|별점|최고의|\d+원|24시간|예약 가능/.test(place.description), place.name);
    assert.equal(place.time, undefined);
    assert.equal(place.move, undefined);
    assert.equal(evidence.get(place.id).checkedAt, '2026-10-12');
    assert.equal(evidence.get(place.id).scope, 'fact-based-original-description-tags');
    assert.equal(plannerBusinessSourceById.get(place.id).scope, 'name-address-category-coordinate');
  }
});

test('New source references use the checked detail or archive record ID and never a missing photo as an inferred coordinate', () => {
  for (const record of busanRecords) {
    const source = plannerBusinessSourceById.get(record.id), url = new URL(source.sourceUrl);
    assert.equal(url.searchParams.get(record.recordId.startsWith('METADATA') ? 'dataSid' : 'uc_seq'), record.recordId);
    assert.equal(source.checkedAt, '2026-10-12');
    assert.ok(record.lat > 35 && record.lat < 35.5 && record.lng > 128.8 && record.lng < 129.4, record.name);
    assert.equal(busan.find(place => place.id === record.id).locationVerified, true);
  }
});

test('Landmark contexts have real food and cafe candidates without forcing a handmade public relation', () => {
  for (const anchorId of ['public-busan-jagalchi','public-busan-gukje','public-busan-huinnyeoul','public-busan-songdo','public-busan-dongnae']) {
    const anchor = landmarkRecords.find(place => place.id === anchorId);
    assert.ok(nearby(anchor,'FOOD',3).length > 0, `${anchor.name} food`);
    assert.ok(nearby(anchor,'CAFE',3).length > 0, `${anchor.name} cafe`);
  }
  const yonggungsa = {lat:35.18833,lng:129.22333};
  assert.ok(nearby(yonggungsa,'FOOD',3).some(place => place.id === 'catalog-busan-gukbo-miyeok'));
});

test('North Gijang cafes stay in the expanded radius, not falsely labeled as within 3km of Ilgwang', () => {
  const ilgwang = landmarkRecords.find(place => place.id === 'public-busan-ilgwang');
  for (const id of ['sea-and-tree','waveon']) {
    const place = busan.find(candidate => candidate.id === `catalog-busan-${id}`);
    assert.ok(distanceBetween(ilgwang,place) > 3);
    assert.ok(distanceBetween(ilgwang,place) <= 15);
    assert.ok(!nearby(ilgwang,'CAFE',3).some(candidate => candidate.id === place.id));
    assert.ok(nearby(ilgwang,'CAFE',15).some(candidate => candidate.id === place.id));
  }
});

test('Landmark IDs and source references preserve the two existing markets and six additional contexts', () => {
  assert.equal(landmarkRecords.length, 8);
  assert.equal(new Set(landmarkRecords.map(place => place.id)).size, 8);
  assert.ok(landmarkRecords.some(place => place.id === 'public-busan-jagalchi'));
  assert.ok(landmarkRecords.some(place => place.id === 'public-busan-gukje'));
  for (const record of landmarkRecords) {
    const url = new URL(record.sourceUrl);
    assert.equal(url.searchParams.get(record.recordId.startsWith('METADATA') ? 'dataSid' : 'uc_seq'), record.recordId);
    assert.ok(record.lat > 35 && record.lat < 35.5 && record.lng > 128.8 && record.lng < 129.4);
  }
});
