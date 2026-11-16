import test from 'node:test';
import assert from 'node:assert/strict';
import { tripPickerStaySelection } from '../src/tripPickerStay.ts';
import { setPlanStay } from '../src/tripPlan.ts';

const stay = (id, extra = {}) => ({ id, kind: 'STAY', name: id, area: '부산', address: `${id} 주소`, lat: 35, lng: 129, image: '', description: '', note: '', duration: '숙박', ...extra });
const fixture = () => ({ id: 'trip', title: '숙소만 있는 여행', purpose: 'PLAN', planStage: 'READY', region: '부산', dateRange: '', duration: '3일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '', story: '', tags: [], saves: 0, author: '나', isMine: true, days: [1, 2, 3].map(day => ({ dayId: `d${day}`, day, date: '', title: '', story: '', places: [], blocks: [] })) });
const choice = { dayId: 'd1', nights: 2, fixed: false };

test('stay preview lists exact occupied nights without checkout or unrelated dates and changes its confirmation version when a booking changes', () => {
  let trip = setPlanStay(fixture(), stay('original'), 'd1', 1, false);
  trip = setPlanStay(trip, stay('second-night'), 'd2', 1, false);
  const before = structuredClone(trip), selection = tripPickerStaySelection(trip, 'new', choice);
  assert.deepEqual(selection.conflicts.map(item => [item.day, item.name, item.fixed]), [[1, 'original', false], [2, 'second-night', false]]);
  assert.deepEqual(trip, before); assert.equal(selection.startDay, 1); assert.equal(selection.lastNightDay, 2);
  const firstNight = tripPickerStaySelection(trip, 'original', { ...choice, nights: 1 }); assert.deepEqual(firstNight.conflicts, []);
  trip.days[1].places[0].bookingFixed = true;
  const changed = tripPickerStaySelection(trip, 'new', choice); assert.notEqual(changed.version, selection.version); assert.equal(changed.conflicts[1].fixed, true);
});

test('a hotel can be added for multiple nights without a landmark; fixed conflicts fail atomically and existing fixed status cannot be silently cleared', () => {
  const original = fixture(), added = setPlanStay(original, stay('hotel'), 'd1', 2, true);
  assert.deepEqual(original.days.flatMap(day => day.places), []);
  assert.deepEqual(added.days.map(day => day.places.map(item => item.id)), [['hotel'], ['hotel'], []]);
  const before = structuredClone(added); assert.throws(() => setPlanStay(added, stay('another'), 'd1', 2, false), /고정/); assert.deepEqual(added, before);
  const sameHotel = setPlanStay(added, stay('hotel'), 'd1', 2, false); assert.ok(sameHotel.days.slice(0, 2).every(day => day.places[0].bookingFixed));
  for (const invalid of [{ ...choice, dayId: 'd3' }, { ...choice, nights: 3 }, { ...choice, nights: 0 }, { ...choice, nights: 1.5 }]) assert.throws(() => tripPickerStaySelection(added, 'new', invalid), /숙박일/);
});
