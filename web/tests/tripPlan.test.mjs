import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalPlan, insertNearby, reorderPlanVisit, removePlanVisit, nearbyCandidates, normalizePlan, distanceBetween } from '../src/tripPlan.ts';

const spot = (id, kind = 'LANDMARK', lng = 126.24) => ({ id, kind, name: id, area: '제주 한림', address: '제주', lat: 33.39, lng, image: '', photos: [], note: '', description: '', duration: '' });
const setup = () => buildPersonalPlan([spot('beach'), spot('tea', 'LANDMARK', 126.29)], 1, '', '나');
test('saved landmarks create a private plan without requiring writing, with stable independent identities', () => {
  const original = [spot('a'), spot('b'), spot('a')];
  const trip = buildPersonalPlan(original, 2, '', '나');
  assert.equal(trip.purpose, 'PLAN'); assert.equal(trip.visibility, 'PRIVATE'); assert.equal(trip.story, '');
  assert.equal(trip.days[0].places.length, 1); assert.equal(trip.days[1].places.length, 1);
  assert.notEqual(trip.days[0].dayId, trip.days[1].dayId);
  assert.deepEqual(normalizePlan(trip), trip); assert.equal(original[0].visitId, undefined);
});
test('nearby selection inserts after its anchor and earlier connected choices, preserving source photo metadata', () => {
  const trip = setup(), day = trip.days[0], anchor = day.places[0].visitId;
  const food = { ...spot('food','FOOD'), photos: [{ image: '/food.jpg', mediaId: 'm1', placeId: 'food', alt: '식당', caption: '사진', sourceId: 'source' }] };
  const one = insertNearby(trip, day.dayId, anchor, food);
  const two = insertNearby(one, day.dayId, anchor, spot('coffee','CAFE'));
  assert.deepEqual(two.days[0].places.map(p => p.id), ['beach','food','coffee','tea']);
  assert.equal(two.days[0].places[1].photos[0].sourceId, 'source');
  assert.equal(insertNearby(two, day.dayId, anchor, food), two);
  assert.equal(trip.days[0].places.length, 2);
  assert.throws(() => insertNearby(trip, 'deleted-day', anchor, food));
  assert.throws(() => insertNearby({ ...trip, isMine: false }, day.dayId, anchor, food));
});
test('moving a landmark preserves connected businesses, visit and card identities and the matching route order', () => {
  const base = setup(), day = base.days[0], anchor = day.places[0].visitId;
  const trip = insertNearby(base, day.dayId, anchor, spot('food','FOOD'));
  const moved = reorderPlanVisit(trip, day.dayId, anchor, 1);
  assert.deepEqual(moved.days[0].places.map(p => p.id), ['tea','beach','food']);
  assert.deepEqual(moved.days[0].blocks.map(b => b.visitId), moved.days[0].places.map(p => p.visitId));
  assert.deepEqual(new Set(moved.days[0].blocks.map(b => b.id)), new Set(trip.days[0].blocks.map(b => b.id)));
});
test('removal can detach or remove connected businesses without affecting a different visit to the same place', () => {
  const base = setup(), day = base.days[0], anchor = day.places[0].visitId;
  const trip = insertNearby(base, day.dayId, anchor, spot('food','FOOD'));
  const detached = removePlanVisit(trip, anchor, false);
  assert.equal(detached.days[0].places[0].id, 'food'); assert.equal(detached.days[0].places[0].anchorVisitId, undefined);
  assert.deepEqual(removePlanVisit(trip, anchor, true).days[0].places.map(p => p.id), ['tea']);
});
test('nearby candidates require verified coordinates and do not turn missing coordinates into distance zero', () => {
  const anchor = spot('a');
  assert.equal(distanceBetween(anchor, { ...spot('b'), lat: null }), null);
  assert.equal(distanceBetween(anchor, { ...spot('b'), locationVerified: false }), null);
  assert.deepEqual(nearbyCandidates(anchor, [spot('near','FOOD'), spot('far','FOOD', 128), spot('cafe','CAFE')], 'FOOD').map(p => p.id), ['near']);
});
