import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlanDay, buildPersonalPlan, copyPersonalPlan, copyPlanDay, insertNearby, makeJournalFromPlan, reorderPlanVisit, removePlanVisit, nearbyCandidates, normalizePlan, distanceBetween, setPlanStay, transferVisit } from '../src/tripPlan.ts';

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

test('nearby radius expansion adds farther candidates without changing distance order or admitting unverified places', () => {
  const anchor=spot('anchor');
  const catalog=[spot('farther','FOOD',126.32),spot('near','FOOD',126.25),spot('outside','FOOD',127),{...spot('unknown','FOOD'),locationVerified:false},spot('cafe','CAFE')];
  assert.deepEqual(nearbyCandidates(anchor,catalog,'FOOD',3).map(p=>p.id),['near']);
  assert.deepEqual(nearbyCandidates(anchor,catalog,'FOOD',15).map(p=>p.id),['near','farther']);
  assert.deepEqual(nearbyCandidates({...anchor,locationVerified:false},catalog,'FOOD',15),[]);
});

test('moving a landmark to another DAY preserves its related business and card identities', () => {
  let trip = addPlanDay(setup());
  const [from,to] = trip.days, visit = from.places[0].visitId;
  trip = insertNearby(trip, from.dayId, visit, spot('food','FOOD'));
  const ids = trip.days[0].blocks.filter(b=>b.visitId===visit || b.placeId==='food').map(b=>b.id);
  const moved = transferVisit(trip, from.dayId, visit, to.dayId, false);
  assert.deepEqual(moved.days[0].places.map(p=>p.id),['tea']);
  assert.deepEqual(moved.days[1].places.map(p=>p.id),['beach','food']);
  assert.deepEqual(moved.days[1].blocks.map(b=>b.id), ids);
  assert.equal(moved.days[1].places[1].anchorVisitId,visit);
  assert.equal(trip.days[1].places.length,0);
});
test('copying a DAY or entire plan remaps references; a copied business never points to the original anchor', () => {
  const base = setup(), day=base.days[0];
  const trip=insertNearby(base,day.dayId,day.places[0].visitId,spot('food','FOOD'));
  const copied=copyPlanDay(trip,day.dayId);
  assert.notEqual(copied.days[0].places[0].visitId,copied.days[1].places[0].visitId);
  assert.equal(copied.days[1].places[1].anchorVisitId,copied.days[1].places[0].visitId);
  assert.equal(new Set(copied.days.flatMap(d=>d.blocks.map(b=>b.id))).size,6);
  const own=copyPersonalPlan(trip,'다른 작성자');
  assert.notEqual(own.id,trip.id);assert.notEqual(own.days[0].dayId,trip.days[0].dayId);
  assert.equal(own.days[0].places[1].anchorVisitId,own.days[0].places[0].visitId);
});
test('journal creation is an independent private snapshot without personal notes or booking details', () => {
  const trip=setup();trip.days[0].places[0].note='개인 메모';trip.days[0].places[0].bookingFixed=true;
  const journal=makeJournalFromPlan(trip,'나');
  assert.equal(journal.purpose,'JOURNAL');assert.equal(journal.visibility,'PRIVATE');assert.equal(journal.sourceTripId,trip.id);
  assert.equal(journal.days[0].places[0].note,'');assert.equal(journal.days[0].places[0].bookingFixed,undefined);
  journal.days[0].places[0].name='새 이름';assert.equal(trip.days[0].places[0].name,'beach');
  assert.notEqual(journal.days[0].blocks[0].id,trip.days[0].blocks[0].id);
});
test('one-night replacement leaves other nights unchanged and locked bookings require unlock', () => {
  const trip=addPlanDay(addPlanDay(setup())), first=trip.days[0].dayId;
  const stay=spot('hotel','STAY');
  const booked=setPlanStay(trip,stay,first,2,true);
  assert.notEqual(booked.days[0].places.at(-1).visitId,booked.days[1].places.at(-1).visitId);
  assert.throws(()=>setPlanStay(booked,spot('another','STAY'),first,1,false),/고정/);
  booked.days[0].places.at(-1).bookingFixed=false;
  const replaced=setPlanStay(booked,spot('another','STAY'),first,1,false);
  assert.equal(replaced.days[0].places.at(-1).id,'another');assert.equal(replaced.days[1].places.at(-1).id,'hotel');
  assert.throws(()=>setPlanStay(trip,stay,trip.days[2].dayId,1,false));
});
