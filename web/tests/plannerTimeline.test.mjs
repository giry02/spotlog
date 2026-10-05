import test from 'node:test';
import assert from 'node:assert/strict';
import { plannerTimeline, plannerVisitContext, planningGapLabel } from '../src/plannerTimeline.ts';
import { applyPlannerSelections, upsertPlannerBusiness, removePlannerBusiness } from '../src/aiPlannerSelections.ts';
import { buildPersonalPlan } from '../src/tripPlan.ts';

const place = (id, kind = 'LANDMARK', slot = 'morning', extra = {}) => ({
  id, visitId: `visit-${id}`, kind, planningSlot: slot, name: id,
  area: '제주', address: '제주 검증 주소', lat: 33.4, lng: 126.2,
  image: '', description: '', note: '', duration: '', ...extra,
});
const card = p => ({ id: `card-${p.visitId}`, type: 'PLACE', placeId: p.id, visitId: p.visitId });
const fixture = () => {
  const trip = buildPersonalPlan([], 3, '완성 일정 검수', '검수자');
  const visits = [
    place('오전 첫 방문'), place('오전 마지막 방문'),
    place('기존 점심', 'FOOD', 'lunch', { anchorVisitId: 'visit-오전 마지막 방문' }),
    place('오후 방문', 'LANDMARK', 'afternoon'),
    place('기존 저녁', 'FOOD', 'dinner', { anchorVisitId: 'visit-오후 방문' }),
    place('예약 호텔', 'STAY', 'stay', { bookingFixed: true, anchorVisitId: 'visit-오후 방문', stayDayIds: [trip.days[0].dayId] }),
  ];
  trip.days[0] = { ...trip.days[0], places: visits, blocks: visits.map(card), planningGaps: [] };
  const nextDay = [place('다음 날 방문'), place('다른 날 숙소', 'STAY', 'stay', { stayDayIds: [trip.days[1].dayId] })];
  trip.days[1] = { ...trip.days[1], places: nextDay, blocks: nextDay.map(card), planningGaps: [] };
  trip.days[2].planningGaps = [];
  return trip;
};
const choice = (trip, id, slot, kind = 'FOOD') => ({
  dayId: trip.days[0].dayId,
  anchorId: slot === 'lunch' ? 'visit-오전 마지막 방문' : 'visit-오후 방문',
  place: place(id, kind, slot), nights: 1,
});
const rowNames = day => plannerTimeline(day).map(row => row.type === 'place' ? row.place.name : `gap-${row.gap.slot}`);
const assertCardsMatch = day => {
  assert.deepEqual(day.blocks.filter(b => b.type === 'PLACE').map(b => b.visitId), day.places.map(p => p.visitId));
  assert.equal(new Set(day.places.map(p => p.visitId)).size, day.places.length);
};

test('missing meal and stay rows appear in the day flow without inventing visits or changing visit order', () => {
  const trip = fixture(), day = trip.days[0];
  day.places = day.places.filter(p => p.kind === 'LANDMARK');
  day.planningGaps = [
    { id: 'g-stay', kind: 'STAY', slot: 'stay', reason: 'booked' },
    { id: 'g-dinner', kind: 'FOOD', slot: 'dinner', reason: 'missing-data' },
    { id: 'g-lunch', kind: 'FOOD', slot: 'lunch', reason: 'missing-data' },
  ];
  const before = structuredClone(day);
  assert.deepEqual(rowNames(day), ['오전 첫 방문', '오전 마지막 방문', 'gap-lunch', '오후 방문', 'gap-dinner', 'gap-stay']);
  assert.deepEqual(plannerTimeline(day).filter(row => row.type === 'place').map(row => row.place), before.places);
  assert.deepEqual(day, before);
  assert.equal(planningGapLabel(day.planningGaps[0]), '예약한 숙소 이용');
  assert.equal(planningGapLabel(day.planningGaps[1], true), 'No verified business available');
});

test('meal context names its nearest surrounding landmarks, in Korean and English', () => {
  const day = fixture().days[0];
  const rows = plannerTimeline(day);
  const lunch = rows.find(row => row.type === 'place' && row.place.planningSlot === 'lunch');
  const dinner = rows.find(row => row.type === 'place' && row.place.planningSlot === 'dinner');
  assert.equal(plannerVisitContext(day, lunch), '오전 마지막 방문 방문 후 · 오후 방문 방문 전');
  assert.equal(plannerVisitContext(day, lunch, true), 'After 오전 마지막 방문 · Before 오후 방문');
  assert.equal(plannerVisitContext(day, dinner), '오후 방문 방문 후');
  day.places = day.places.filter(p => p.planningSlot !== 'lunch');
  day.planningGaps = [{ id: 'lunch', slot: 'lunch', kind: 'FOOD', reason: 'missing-data' }];
  const gap = plannerTimeline(day).find(row => row.type === 'gap');
  assert.equal(plannerVisitContext(day, gap), '오전 마지막 방문 방문 후 · 오후 방문 방문 전');
});

test('changing lunch or dinner replaces only that meal and preserves visit position, hotels and other DAYs', () => {
  for (const slot of ['lunch', 'dinner']) {
    const trip = fixture(), snapshot = structuredClone(trip), next = choice(trip, `새 ${slot}`, slot);
    const updated = applyPlannerSelections(trip, [], upsertPlannerBusiness([], trip, next));
    const expected = snapshot.days[0].places.map(p => p.kind === 'FOOD' && p.planningSlot === slot ? `새 ${slot}` : p.id);
    assert.deepEqual(updated.days[0].places.map(p => p.id), expected);
    assert.deepEqual(updated.days.slice(1), snapshot.days.slice(1));
    assert.deepEqual(updated.days[0].places.find(p => p.kind === 'STAY'), snapshot.days[0].places.find(p => p.kind === 'STAY'));
    assert.equal(updated.days[0].places.find(p => p.id === `새 ${slot}`).anchorVisitId, next.anchorId);
    for (const original of snapshot.days[0].blocks.filter(b => !snapshot.days[0].places.some(p => p.kind === 'FOOD' && p.planningSlot === slot && p.visitId === b.visitId))) {
      assert.deepEqual(updated.days[0].blocks.find(b => b.id === original.id), original);
    }
    assertCardsMatch(updated.days[0]);
    assert.deepEqual(trip, snapshot);
  }
});

test('the same restaurant can be lunch and dinner without replacing the other slot', () => {
  const trip = fixture(), lunch = choice(trip, '한 식당', 'lunch'), dinner = choice(trip, '한 식당', 'dinner');
  let selections = upsertPlannerBusiness([], trip, lunch);
  selections = upsertPlannerBusiness(selections, trip, dinner);
  const updated = applyPlannerSelections(trip, [], selections);
  const visits = updated.days[0].places.filter(p => p.id === '한 식당');
  assert.deepEqual(visits.map(p => p.planningSlot), ['lunch', 'dinner']);
  assert.notEqual(visits[0].visitId, visits[1].visitId);
  const removed = removePlannerBusiness(selections, trip, trip.days[0].dayId, '한 식당', 'lunch');
  assert.deepEqual(removed, [dinner]);
  const after = applyPlannerSelections(trip, [], removed);
  assert.deepEqual(after.days[0].places.filter(p => p.kind === 'FOOD').map(p => [p.id, p.planningSlot]), [['기존 점심', 'lunch'], ['한 식당', 'dinner']]);
  assertCardsMatch(updated.days[0]);
});

test('filling a missing lunch removes only its displayed gap and removing the selection restores the gap', () => {
  const trip = fixture(), day = trip.days[0];
  day.places = day.places.filter(p => p.kind !== 'FOOD');
  day.blocks = day.places.map(card);
  day.planningGaps = [
    { id: 'g-lunch', kind: 'FOOD', slot: 'lunch', reason: 'missing-data', afterVisitId: 'visit-오전 마지막 방문', beforeVisitId: 'visit-오후 방문' },
    { id: 'g-dinner', kind: 'FOOD', slot: 'dinner', reason: 'missing-data', afterVisitId: 'visit-오후 방문' },
  ];
  const selected = [choice(trip, '선택한 식당', 'lunch')];
  const filled = applyPlannerSelections(trip, [], selected);
  assert.deepEqual(plannerTimeline(filled.days[0]).filter(row => row.type === 'gap').map(row => row.gap.id), ['g-dinner']);
  assert.deepEqual(rowNames(filled.days[0]), ['오전 첫 방문', '오전 마지막 방문', '선택한 식당', '오후 방문', 'gap-dinner', '예약 호텔']);
  const removed = removePlannerBusiness(selected, trip, day.dayId, '선택한 식당', 'lunch');
  assert.deepEqual(plannerTimeline(applyPlannerSelections(trip, [], removed).days[0]).filter(row => row.type === 'gap').map(row => row.gap.id), ['g-lunch', 'g-dinner']);
  assert.deepEqual(filled.days.slice(1), trip.days.slice(1));
});

test('removing a landmark removes its unbooked original business and skips new choices with that missing anchor', () => {
  const trip = fixture(), excluded = 'visit-오전 마지막 방문';
  const updated = applyPlannerSelections(trip, [excluded], [choice(trip, '추가 식당', 'lunch')]);
  assert.equal(updated.days[0].places.some(p => [excluded, 'visit-기존 점심'].includes(p.visitId) || p.id === '추가 식당'), false);
  assert.equal(updated.days[0].places.some(p => p.anchorVisitId === excluded), false);
  assert.equal(updated.days[0].blocks.some(b => [excluded, 'visit-기존 점심'].includes(b.visitId)), false);
  assert.deepEqual(updated.days.slice(1), trip.days.slice(1));
  assertCardsMatch(updated.days[0]);
});

test('removing a sightseeing anchor preserves booked accommodation and leaves no orphaned link', () => {
  const trip = fixture(), hotel = trip.days[0].places.find(p => p.kind === 'STAY');
  const updated = applyPlannerSelections(trip, ['visit-오후 방문'], []);
  const preserved = updated.days[0].places.find(p => p.visitId === hotel.visitId);
  assert.ok(preserved, 'a booked hotel must not be removed with its sightseeing anchor');
  assert.equal(preserved.bookingFixed, true);
  assert.deepEqual(preserved.stayDayIds, hotel.stayDayIds);
  assert.ok(!preserved.anchorVisitId || updated.days.flatMap(d => d.places).some(p => p.visitId === preserved.anchorVisitId));
  assert.deepEqual(updated.days.slice(1), trip.days.slice(1));
  assertCardsMatch(updated.days[0]);
});

test('gap actions never retain an excluded landmark as their insertion anchor', () => {
  const trip = fixture(), day = trip.days[0];
  day.places = day.places.filter(p => p.planningSlot !== 'lunch');
  day.blocks = day.places.map(card);
  day.planningGaps = [{ id: 'missing-lunch', slot: 'lunch', kind: 'FOOD', reason: 'missing-data', afterVisitId: 'visit-오전 마지막 방문', beforeVisitId: 'visit-오후 방문' }];
  const updated = applyPlannerSelections(trip, ['visit-오전 마지막 방문'], []);
  const ids = new Set(updated.days[0].places.filter(p => p.kind === 'LANDMARK').map(p => p.visitId));
  const gaps = plannerTimeline(updated.days[0]).filter(row => row.type === 'gap');
  assert.equal(gaps.length, 1);
  for (const { gap } of gaps) {
    assert.ok(!gap.afterVisitId || ids.has(gap.afterVisitId), 'gap afterVisitId must be a current landmark');
    assert.ok(!gap.beforeVisitId || ids.has(gap.beforeVisitId), 'gap beforeVisitId must be a current landmark');
  }
  assert.equal(plannerVisitContext(updated.days[0], gaps[0]), '오전 첫 방문 방문 후 · 오후 방문 방문 전');
});
