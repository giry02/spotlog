import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

// Source uses bundler-style imports; resolve only its two pure TS dependencies for Node tests.
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.endsWith('/tripPlacement.ts') && ['./journeyCreation', './visits'].includes(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const { applyTripPlacement, tripPeriodLabel } = await import('../src/tripPlacement.ts');
hooks.deregister();

const place = { id: 'seoul-forest', visitId: 'source-visit', kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울', lat: 37.54, lng: 127.04, image: '/forest.jpg', description: '초록 산책', note: '', duration: '1시간' };
const day = (number) => ({ day: number, date: `DAY ${number}`, title: `${number}일차`, story: '원래 이야기', places: [], blocks: [{ id: `text-${number}`, type: 'TEXT', body: '원문' }, { id: `image-${number}`, type: 'IMAGE', image: '/my-image.jpg', caption: '내 사진' }] });
const journey = (id = 'mine') => ({ id, title: '기존 여행', region: '서울', dateRange: '날짜 미정', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '/cover.jpg', summary: '기존 소개', story: '', tags: [], saves: 0, author: '나', isMine: true, days: [day(1), day(2)] });
const request = (values = {}) => ({ journeyId: 'mine', title: '서울 여행', region: '서울', dayCount: 2, startDate: '', targetDay: 2, places: [place], ...values });

test('new two-day journey places on DAY 2, preserving empty DAY 1 and requested dates', () => {
  const source = journey(); const sources = [source]; const snapshot = structuredClone(sources);
  const result = applyTripPlacement(sources, request({ journeyId: null, startDate: '2026-10-31' }), '여행자');
  assert.equal(result.ok, true); assert.equal(result.targetDay, 2); assert.equal(result.addedCount, 1);
  const created = result.journeys[0];
  assert.equal(created.days.length, 2); assert.equal(created.days[0].places.length, 0);
  assert.equal(created.days[1].date, '2026-11-01'); assert.equal(created.days[1].places[0].id, place.id);
  assert.notEqual(created.days[1].places[0].visitId, place.visitId);
  assert.equal(created.days[1].places[0].visitId, created.days[1].blocks[0].visitId);
  assert.equal(created.isMine, true); assert.equal(created.visibility, 'PRIVATE');
  assert.deepEqual(sources, snapshot); assert.equal(result.journeys[1], source);
});

test('existing-trip placement does not change period, dates, title, other DAYs or other journeys', () => {
  const source = journey(); const another = journey('another'); const sources = [source, another]; const snapshot = structuredClone(sources);
  const result = applyTripPlacement(sources, request({ dayCount: 7, title: '다른 제목', startDate: '2026-11-01' }), '나');
  assert.equal(result.ok, true); assert.equal(result.journeys[1], another);
  const updated = result.journeys[0];
  assert.equal(updated.days.length, 2); assert.equal(updated.title, source.title); assert.equal(updated.dateRange, source.dateRange);
  assert.equal(updated.days[0], source.days[0]); assert.deepEqual(updated.days[1].blocks.slice(0, 2), source.days[1].blocks);
  assert.deepEqual(sources, snapshot);
});

test('same place can be on another DAY but is never duplicated on the same DAY', () => {
  const first = applyTripPlacement([journey()], request({ targetDay: 1 }), '나');
  const second = applyTripPlacement(first.journeys, request({ targetDay: 2 }), '나');
  const repeated = applyTripPlacement(second.journeys, request({ targetDay: 2 }), '나');
  assert.equal(second.addedCount, 1); assert.equal(repeated.addedCount, 0); assert.equal(repeated.duplicateCount, 1);
  assert.equal(repeated.journeys[0], second.journeys[0]);
  assert.notEqual(second.journeys[0].days[0].places[0].visitId, second.journeys[0].days[1].places[0].visitId);
});

test('batch deduplicates incoming places and adds only missing places', () => {
  const original = applyTripPlacement([journey()], request(), '나').journeys;
  const another = { ...place, id: 'another', name: '다른 장소' };
  const result = applyTripPlacement(original, request({ places: [place, place, another] }), '나');
  assert.equal(result.ok, true); assert.equal(result.addedCount, 1); assert.equal(result.duplicateCount, 1);
  assert.equal(result.journeys[0].days[1].places.length, 2);
});

test('public originals, removed trips and removed DAYs are rejected without mutation', () => {
  const publicJourney = { ...journey(), isMine: false, visibility: 'PUBLIC' }; const snapshot = structuredClone(publicJourney);
  assert.equal(applyTripPlacement([publicJourney], request(), '나').ok, false);
  assert.equal(applyTripPlacement([], request(), '나').ok, false);
  assert.equal(applyTripPlacement([journey()], request({ targetDay: 3 }), '나').ok, false);
  assert.deepEqual(publicJourney, snapshot);
});

test('invalid periods, dates, titles, target DAYs or no places cannot create a journey', () => {
  for (const dayCount of [0, 8, -1, 1.5, NaN]) assert.equal(applyTripPlacement([], request({ journeyId: null, dayCount }), '나').ok, false);
  for (const targetDay of [0, 3, 1.5, NaN]) assert.equal(applyTripPlacement([], request({ journeyId: null, targetDay }), '나').ok, false);
  for (const startDate of ['2026-02-30', 'invalid']) assert.equal(applyTripPlacement([], request({ journeyId: null, startDate }), '나').ok, false);
  assert.equal(applyTripPlacement([], request({ journeyId: null, title: '  ' }), '나').ok, false);
  assert.equal(applyTripPlacement([], request({ journeyId: null, places: [] }), '나').ok, false);
});

test('day trip and seven-day labels correspond to selected duration, not placement day', () => {
  assert.equal(tripPeriodLabel(1), '당일치기'); assert.equal(tripPeriodLabel(2), '1박 2일'); assert.equal(tripPeriodLabel(7), '6박 7일');
  const result = applyTripPlacement([], request({ journeyId: null, dayCount: 1, targetDay: 1 }), '나');
  assert.equal(result.ok, true); assert.equal(result.journeys[0].days.length, 1);
});
