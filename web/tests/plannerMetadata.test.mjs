import test from 'node:test';
import assert from 'node:assert/strict';
import { appendPlanLandmark, buildPersonalPlan, copyPersonalPlan, copyPlanDay, insertNearby, makeJournalFromPlan, removePlanDay, removePlanVisit, reorderPlanVisit, setPlanStay, transferVisit } from '../src/tripPlan.ts';

const place = (id, kind = 'LANDMARK') => ({ id, name: id, kind, area: '제주 한림', address: '제주 한림', lat: 33.4, lng: 126.25, image: '', photos: [], description: '', note: '', duration: '' });
function fixture() {
  const journey = buildPersonalPlan([place('morning'), place('afternoon')], 1, '내 일정', '나');
  const day = journey.days[0];
  day.places[0].planningSlot = 'morning';
  day.places[1].planningSlot = 'afternoon';
  day.planningGaps = [{ id: 'lunch-gap', kind: 'FOOD', slot: 'lunch', reason: 'missing-data', afterVisitId: day.places[0].visitId, beforeVisitId: day.places[1].visitId }];
  journey.days.push({ dayId: 'next-day', day: 2, date: 'DAY 2', title: '2일차', story: '', places: [], blocks: [] });
  return journey;
}
function validReferences(day) {
  const positions = new Map(day.places.filter(p => p.kind === 'LANDMARK').map((p, i) => [p.visitId, i]));
  for (const gap of day.planningGaps ?? []) {
    if (gap.afterVisitId !== undefined) assert.ok(positions.has(gap.afterVisitId));
    if (gap.beforeVisitId !== undefined) assert.ok(positions.has(gap.beforeVisitId));
    if (gap.afterVisitId !== undefined && gap.beforeVisitId !== undefined) assert.ok(positions.get(gap.afterVisitId) < positions.get(gap.beforeVisitId));
  }
}

test('copying an AI plan gives gaps new identities and remaps their visit boundaries', () => {
  const original = fixture(), snapshot = structuredClone(original);
  const copy = copyPersonalPlan(original, '나');
  const day = copy.days[0], gap = day.planningGaps[0];
  assert.notEqual(gap.id, original.days[0].planningGaps[0].id);
  assert.equal(gap.afterVisitId, day.places[0].visitId);
  assert.equal(gap.beforeVisitId, day.places[1].visitId);
  assert.deepEqual(day.places.map(p => p.planningSlot), ['morning', 'afternoon']);
  assert.ok(!Object.hasOwn(copy.days[1], 'planningGaps'));
  gap.reason = 'booked';
  assert.deepEqual(original, snapshot);
});

test('copying one DAY keeps its unfilled slots independent from the original DAY', () => {
  const original = fixture(), copy = copyPlanDay(original, original.days[0].dayId);
  const day = copy.days[2], gap = day.planningGaps[0];
  assert.equal(gap.afterVisitId, day.places[0].visitId);
  assert.equal(gap.beforeVisitId, day.places[1].visitId);
  assert.notEqual(gap.id, original.days[0].planningGaps[0].id);
  assert.deepEqual(copy.days[0], original.days[0]);
  validReferences(day);
});

test('copying an overnight gap reserves a following DAY, as copying a selected hotel does', () => {
  const original = fixture(), source = original.days[0];
  source.planningGaps.push({ id: 'stay-gap', kind: 'STAY', slot: 'stay', reason: 'booked', afterVisitId: source.places[1].visitId });
  const copy = copyPlanDay(original, source.dayId);
  assert.equal(copy.days.length, 4);
  assert.equal(copy.days[2].planningGaps.at(-1).reason, 'booked');
  assert.deepEqual(copy.days[3].places, []);
  assert.equal(copy.days[2].planningGaps.at(-1).afterVisitId, copy.days[2].places[1].visitId);
  const atLimit = { ...original, days: [...original.days, ...Array.from({ length: 27 }, (_, i) => ({ ...original.days[1], dayId: `empty-${i}`, day: i + 3 }))] };
  assert.throws(() => copyPlanDay(atLimit, source.dayId), /30일/);
});

test('removing a gap boundary preserves the slot and only uses surviving same-DAY landmarks', () => {
  const original = fixture(), snapshot = structuredClone(original), day = original.days[0];
  const next = removePlanVisit(original, day.places[0].visitId, false);
  assert.equal(next.days[0].planningGaps[0].id, 'lunch-gap');
  assert.equal(next.days[0].planningGaps[0].afterVisitId, undefined);
  assert.equal(next.days[0].planningGaps[0].beforeVisitId, day.places[1].visitId);
  validReferences(next.days[0]);
  const empty = removePlanVisit(next, day.places[1].visitId, true);
  assert.equal(empty.days[0].planningGaps[0].afterVisitId, undefined);
  assert.equal(empty.days[0].planningGaps[0].beforeVisitId, undefined);
  assert.deepEqual(original, snapshot);
});

test('reordering landmarks never leaves a gap pointing backward through the displayed order', () => {
  const original = fixture(), day = original.days[0];
  const reordered = reorderPlanVisit(original, day.dayId, day.places[0].visitId, 1);
  assert.deepEqual(reordered.days[0].places.map(p => p.id), ['afternoon', 'morning']);
  validReferences(reordered.days[0]);
  assert.equal(reordered.days[0].planningGaps[0].id, 'lunch-gap');
});

test('moving visits to another DAY clears old time-of-day labels without moving the source DAY gaps', () => {
  const original = fixture(), day = original.days[0], nextDay = original.days[1];
  const withFood = insertNearby(original, day.dayId, day.places[0].visitId, place('food', 'FOOD'));
  withFood.days[0].places[1].planningSlot = 'lunch';
  const moved = transferVisit(withFood, day.dayId, day.places[0].visitId, nextDay.dayId, false);
  assert.deepEqual(moved.days[1].places.map(p => p.id), ['morning', 'food']);
  assert.ok(moved.days[1].places.every(p => !Object.hasOwn(p, 'planningSlot')));
  assert.equal(moved.days[1].places[1].anchorVisitId, moved.days[1].places[0].visitId);
  assert.ok(!Object.hasOwn(moved.days[1], 'planningGaps'));
  assert.equal(moved.days[0].planningGaps[0].id, 'lunch-gap');
  validReferences(moved.days[0]);
  assert.equal(withFood.days[0].places[0].planningSlot, 'morning');
});

test('copying a single visit cannot copy unrelated missing slots or the original time-of-day label', () => {
  const original = fixture(), day = original.days[0];
  const copied = transferVisit(original, day.dayId, day.places[0].visitId, original.days[1].dayId, true);
  assert.deepEqual(copied.days[0], original.days[0]);
  assert.notEqual(copied.days[1].places[0].visitId, day.places[0].visitId);
  assert.ok(!Object.hasOwn(copied.days[1].places[0], 'planningSlot'));
  assert.ok(!Object.hasOwn(copied.days[1], 'planningGaps'));
});

test('removing the final DAY removes an impossible overnight gap on the new final DAY only', () => {
  const original = fixture(), day = original.days[0];
  day.planningGaps.push({ id: 'stay-gap', kind: 'STAY', slot: 'stay', reason: 'missing-data', afterVisitId: day.places[1].visitId });
  const shortened = removePlanDay(original, original.days[1].dayId);
  assert.deepEqual(shortened.days[0].planningGaps.map(gap => gap.id), ['lunch-gap']);
  assert.equal(original.days[0].planningGaps.length, 2);
  validReferences(shortened.days[0]);
});

test('choosing a hotel removes only the covered DAY overnight gap, keeping meal gaps', () => {
  const original = fixture(), day = original.days[0];
  day.planningGaps.push({ id: 'stay-gap', kind: 'STAY', slot: 'stay', reason: 'booked', afterVisitId: day.places[1].visitId });
  const chosen = setPlanStay(original, { ...place('hotel', 'STAY'), planningSlot: 'stay' }, day.dayId, 1, true);
  assert.deepEqual(chosen.days[0].planningGaps.map(gap => gap.id), ['lunch-gap']);
  assert.equal(chosen.days[0].places.at(-1).planningSlot, 'stay');
  assert.equal(original.days[0].planningGaps.length, 2);
});

test('converting to a journal strips private planning slots, gaps and conditions without changing the plan', () => {
  const original = fixture(), day = original.days[0];
  day.planningGaps.push({ id: 'private-booking', kind: 'STAY', slot: 'stay', reason: 'booked' });
  original.planningPreferences = { prompt: 'private booking request' };
  const snapshot = structuredClone(original), journal = makeJournalFromPlan(original, '나');
  assert.ok(journal.days.every(d => !Object.hasOwn(d, 'planningGaps') && d.places.every(p => !Object.hasOwn(p, 'planningSlot'))));
  assert.equal(journal.planningPreferences, undefined);
  assert.equal(journal.visibility, 'PRIVATE');
  assert.ok(!JSON.stringify(journal).includes('private-booking'));
  assert.ok(!JSON.stringify(journal).includes('private booking request'));
  assert.deepEqual(original, snapshot);
});

test('starting or manually adding saved places does not inherit another trip’s AI time slot', () => {
  const source = { ...place('saved'), planningSlot: 'dinner' };
  const created = buildPersonalPlan([source], 1, '', '나');
  assert.ok(!Object.hasOwn(created.days[0].places[0], 'planningSlot'));
  const original = fixture(), day = original.days[0];
  const added = appendPlanLandmark(original, day.dayId, source);
  assert.ok(!Object.hasOwn(added.days[0].places.find(p => p.id === source.id), 'planningSlot'));
  const nearby = insertNearby(original, day.dayId, day.places[0].visitId, { ...place('cafe', 'CAFE'), planningSlot: 'afternoon' });
  assert.ok(!Object.hasOwn(nearby.days[0].places.find(p => p.id === 'cafe'), 'planningSlot'));
  assert.equal(source.planningSlot, 'dinner');
});

test('legacy trips remain free of new planning fields through copy, move, remove and journal conversion', () => {
  const original = buildPersonalPlan([place('a'), place('b')], 2, '', '나');
  const variants = [copyPersonalPlan(original, '나'), copyPlanDay(original, original.days[0].dayId), transferVisit(original, original.days[0].dayId, original.days[0].places[0].visitId, original.days[1].dayId, false), removePlanVisit(original, original.days[0].places[0].visitId, false), makeJournalFromPlan(original, '나')];
  for (const variant of variants) assert.ok(variant.days.every(day => !Object.hasOwn(day, 'planningGaps') && day.places.every(p => !Object.hasOwn(p, 'planningSlot'))));
});
