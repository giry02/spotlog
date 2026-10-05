import test from 'node:test';
import assert from 'node:assert/strict';
import { plannerBusinessPlaces, plannerBusinessSources } from '../src/plannerBusinessCatalog.ts';
import { catalogVersion, defaultPlannerConditions, generatePlannerSample, validatePlannerResult } from '../src/aiPlanner.ts';
import { distanceBetween } from '../src/tripPlan.ts';

const landmark = (id, name, lat, lng) => ({ id, name, kind: 'LANDMARK', area: '부산 해운대', address: '부산 해운대', lat, lng, image: '', description: '', note: '', duration: '' });
const haeundae = landmark('haeundae', '해운대해수욕장', 35.1590004, 129.1600037);
const dongbaek = landmark('dongbaek', '동백섬', 35.1523895, 129.1526031);
const catalog = [haeundae, dongbaek, ...plannerBusinessPlaces];

test('added businesses have unique place IDs and a checked official source for their coordinates', () => {
  assert.equal(plannerBusinessPlaces.length, 15);
  assert.equal(new Set(plannerBusinessPlaces.map(p => p.id)).size, plannerBusinessPlaces.length);
  assert.equal(new Set(plannerBusinessSources.map(s => s.providerRecordId)).size, plannerBusinessPlaces.length);
  for (const place of plannerBusinessPlaces) {
    const source = plannerBusinessSources.find(s => s.placeId === place.id);
    assert.ok(source, place.id);
    assert.equal(new URL(source.sourceUrl).hostname, 'www.visitbusan.net');
    assert.equal(new URL(source.sourceUrl).searchParams.get('uc_seq'), source.providerRecordId);
    assert.equal(source.scope, 'name-address-category-coordinate');
    assert.equal(source.checkedAt, place.kind==='CAFE'?'2026-09-26':'2026-09-21');
    assert.ok(place.lat > 35 && place.lat < 35.3 && place.lng > 128.9 && place.lng < 129.3, place.name);
    assert.equal(place.locationVerified, true);
    assert.equal(place.image, '', 'Unlicensed or unrelated images must not be used as business photos');
    assert.equal(place.time, undefined);
    assert.equal(place.move, undefined);
  }
});

test('Haeundae landmarks have multiple distinct nearby meals and lodging choices', () => {
  for (const anchor of [haeundae, dongbaek]) {
    const nearby = plannerBusinessPlaces.filter(p => distanceBetween(anchor, p) < 3);
    assert.ok(nearby.filter(p => p.kind === 'FOOD').length >= 3);
    assert.ok(nearby.filter(p => p.kind === 'STAY').length >= 4);
  }
  assert.equal(plannerBusinessPlaces.filter(p => p.kind === 'FOOD').length, 8);
  assert.equal(plannerBusinessPlaces.filter(p => p.kind === 'STAY').length, 4);
  assert.equal(plannerBusinessPlaces.filter(p => p.kind === 'CAFE').length, 3);
});

test('the added catalog generates meals and lodging in context, and still honors exclusions', () => {
  const request = prompt => ({ requestId: 'business-catalog', sourceVersion: catalogVersion(catalog), language: 'ko', selectedPlaceIds: [], dayIds: [], lockedVisitIds: [], conditions: { ...defaultPlannerConditions(), region: '부산', dayCount: 2, prompt }, catalog, savedPlaces: [haeundae, dongbaek], author: '나' });
  const fullRequest = request('부산 1박 2일, 맛집과 숙소 포함');
  const full = validatePlannerResult(fullRequest, generatePlannerSample(fullRequest)).data.journey;
  const first = full.days[0];
  const meals = first.places.filter(p => p.kind === 'FOOD');
  assert.deepEqual(meals.map(p => p.planningSlot), ['lunch', 'dinner']);
  assert.notEqual(meals[0].id, meals[1].id);
  assert.equal(first.places.at(-1).kind, 'STAY');
  for (const day of full.days) for (const place of day.places.filter(p => p.kind !== 'LANDMARK')) {
    assert.ok(day.places.some(p => p.kind === 'LANDMARK' && p.visitId === place.anchorVisitId));
    assert.ok(plannerBusinessPlaces.some(p => p.id === place.id && p.lat === place.lat && p.lng === place.lng));
  }
  const onlyRequest = request('부산 1박 2일, 관광지만');
  const only = validatePlannerResult(onlyRequest, generatePlannerSample(onlyRequest)).data.journey;
  assert.ok(only.days.flatMap(d => d.places).every(p => p.kind === 'LANDMARK'));
});
