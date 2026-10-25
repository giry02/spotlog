import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.includes('/lib/') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
} });

const { appendTrip, createTripSession, currentTrip, makePlan } = await import('../lib/trip-engine.ts');
const { parseTripAction, parseTripSession } = await import('../lib/chat-contract.ts');
const { restaurants } = await import('../lib/trip-data.ts');
const step = (session, action) => appendTrip(session, parseTripAction(action));
const foodIds = ['catalog-busan-geumsu', 'catalog-busan-geodae'];
const shopIds = ['public-busan-gukje', 'public-busan-jagalchi'];
function collect(ids, days = 1, mode = 'registered') {
  let session = createTripSession([], [], mode);
  for (const id of ids) session = step(session, { type: 'collect-entity', id });
  return step(session, { type: 'configure', days });
}

test('two collected restaurants sharing a tourism anchor occupy the requested two days', () => {
  assert.equal(restaurants.find(item => item.id === foodIds[0]).placeId, restaurants.find(item => item.id === foodIds[1]).placeId);
  const before = collect(foodIds, 2), frozen = structuredClone(before);
  const result = step(before, { type: 'build' }), state = currentTrip(result);
  assert.deepEqual(state.plan.map(({ day, entityId, kind }) => ({ day, entityId, kind })), foodIds.map((entityId, i) => ({ day: i + 1, entityId, kind: 'food' })));
  assert.deepEqual(state.collectedIds, foodIds);
  assert.deepEqual(before, frozen);
  assert.ok(parseTripSession(result));
});

test('business-only plans keep interleaved collection order across different anchors', () => {
  const ids = [foodIds[0], shopIds[0], foodIds[1]];
  const oneDay = currentTrip(step(collect(ids), { type: 'build' }));
  assert.deepEqual(oneDay.plan.map(v => v.entityId), ids);
  assert.deepEqual(oneDay.plan.map(v => v.kind), ['food', 'shop', 'food']);
  assert.deepEqual(oneDay.plan.map(v => v.day), [1, 1, 1]);
  const twoDays = currentTrip(step(collect(ids, 2), { type: 'build' }));
  assert.deepEqual(twoDays.plan.map(v => v.entityId), ids);
  assert.deepEqual(twoDays.plan.map(v => v.day), [1, 1, 2]);
});

test('business distribution fills every requested day when enough explicitly collected stops exist', () => {
  const ids = [...foodIds, ...shopIds, 'catalog-busan-bibibidang'];
  const result = step(collect(ids, 4), { type: 'build' }), state = currentTrip(result);
  assert.deepEqual(state.plan.map(v => v.entityId), ids);
  assert.deepEqual([...new Set(state.plan.map(v => v.day))], [1, 2, 3, 4]);
  assert.equal(state.plan.length, ids.length);
  assert.ok(parseTripSession(result));
});

test('a collected rebuild preserves explicit metadata by business identity when generated IDs change owners', () => {
  let session = step(collect(foodIds), { type: 'build' });
  session = step(session, { type: 'trip-meta', title: '부산 식당 검수', startDate: '2026-11-03' });
  const originalIds = currentTrip(session).plan.map(v => v.id);
  session = step(session, { type: 'visit-details', id: originalIds[0], note: '창가 자리 요청', time: '11:30', durationMinutes: 60 });
  session = step(session, { type: 'visit-details', id: originalIds[1], note: '저녁 식사', time: '18:00', durationMinutes: 90 });
  session = step(session, { type: 'uncollect-entity', id: foodIds[0] });
  session = step(session, { type: 'collect-entity', id: foodIds[0] });
  session = step(session, { type: 'configure', days: 2 });
  const before = structuredClone(session), result = step(session, { type: 'build' }), state = currentTrip(result);
  assert.deepEqual(state.plan.map(v => v.entityId), [...foodIds].reverse());
  assert.equal(state.plan[0].id, originalIds[0]);
  assert.equal(state.plan[0].note, '저녁 식사');
  assert.equal(state.plan[0].time, '18:00');
  assert.equal(state.plan[0].durationMinutes, 90);
  assert.equal(state.plan[1].note, '창가 자리 요청');
  assert.equal(state.plan[1].time, '11:30');
  assert.equal(state.plan[1].durationMinutes, 60);
  assert.equal(state.title, '부산 식당 검수');
  assert.equal(state.startDate, '2026-11-03');
  assert.deepEqual(session, before);
  assert.ok(parseTripSession(result));
});

test('same-hotel night occurrences preserve their individual details without shifting metadata to new nights', () => {
  let session = step(collect([foodIds[0], 'catalog-busan-westin'], 3), { type: 'build' });
  const nights = currentTrip(session).plan.filter(v => v.kind === 'stay');
  assert.equal(nights.length, 2);
  session = step(session, { type: 'visit-details', id: nights[0].id, note: '첫날 짐 보관', time: '15:00', durationMinutes: 30 });
  session = step(session, { type: 'visit-details', id: nights[1].id, note: '둘째 날 휴식', time: '19:30', durationMinutes: 90 });
  session = step(session, { type: 'configure', days: 4 });
  const result = step(session, { type: 'build' }), stays = currentTrip(result).plan.filter(v => v.kind === 'stay');
  assert.deepEqual(stays.slice(0, 2).map(({ note, time, durationMinutes }) => ({ note, time, durationMinutes })), [
    { note: '첫날 짐 보관', time: '15:00', durationMinutes: 30 },
    { note: '둘째 날 휴식', time: '19:30', durationMinutes: 90 },
  ]);
  assert.equal(stays[2].note, undefined);
  assert.equal(stays[2].time, undefined);
  assert.equal(stays[2].durationMinutes, undefined);
  assert.ok(parseTripSession(result));
});

test('explicitly cleared details survive a rebuild without leaking into another business', () => {
  let session = step(collect(foodIds), { type: 'build' });
  session = step(session, { type: 'visit-details', id: currentTrip(session).plan[0].id, note: '', time: '', durationMinutes: 0 });
  const state = currentTrip(step(session, { type: 'build' }));
  assert.equal(state.plan[0].note, '');
  assert.equal(state.plan[0].time, '');
  assert.equal(state.plan[0].durationMinutes, 0);
  assert.equal(state.plan[1].note, undefined);
  assert.equal(state.plan[1].time, undefined);
  assert.equal(state.plan[1].durationMinutes, undefined);
});

test('mixed landmark/business collection retains the existing anchor-grouped plan layout', () => {
  const ids = ['hyeopjae', 'of-cafe', 'hj-rice', 'osulloc'];
  const state = currentTrip(step(collect(ids, 2, 'demo'), { type: 'build' }));
  assert.deepEqual(state.plan.map(v => [v.day, v.entityId]), [[1, 'hyeopjae'], [1, 'hj-rice'], [2, 'osulloc'], [2, 'of-cafe']]);
});

test('booked overnight records stay byte-for-byte unchanged, and blocked shorter builds do not mutate the original', () => {
  let session = collect(foodIds, 2);
  session = step(session, { type: 'configure', booked: true });
  session = step(session, { type: 'build' });
  const locked = structuredClone(currentTrip(session).plan.filter(v => v.kind === 'stay' && v.locked));
  assert.equal(locked.length, 1);
  const result = step(session, { type: 'build' });
  assert.deepEqual(currentTrip(result).plan.filter(v => v.locked), locked);
  const before = currentTrip(result), frozen = structuredClone(before);
  const blocked = makePlan({ ...before, days: 1 });
  assert.deepEqual(blocked.plan, before.plan);
  assert.equal(blocked.days, 2);
  assert.deepEqual(before, frozen);
  assert.ok(parseTripSession(result));
});
