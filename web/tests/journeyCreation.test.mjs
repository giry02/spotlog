import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyFromPlaces } from '../src/journeyCreation.ts';

const place = { id: 'anmok', visitId: 'existing-visit', name: '안목해변', kind: 'LANDMARK', area: '강원 강릉', address: '강릉', lat: 37.77, lng: 128.95, image: '/anmok.jpg', description: '바다', note: '', duration: '1시간' };
const options = { title: '강릉 여행', days: 2, startDate: '2026-10-31', places: [place] };

test('new journey preserves requested dates, starts saved places on DAY 1 and never alters sources', () => {
  const original = structuredClone(options);
  const result = createJourneyFromPlaces(options, '작성자');
  assert.equal(result.title, '강릉 여행');
  assert.equal(result.dateRange, '2026-10-31 ~ 2026-11-01');
  assert.equal(result.duration, '1박 2일');
  assert.equal(result.days[1].date, '2026-11-01');
  assert.equal(result.days[1].places.length, 0);
  assert.equal(result.days[0].places[0].id, place.id);
  assert.notEqual(result.days[0].places[0].visitId, place.visitId);
  assert.equal(result.days[0].places[0].visitId, result.days[0].blocks[0].visitId);
  assert.deepEqual(options, original);
});

test('missing dates remain explicit DAYs and duplicate source places occur once', () => {
  const result = createJourneyFromPlaces({ ...options, startDate: '', places: [place, place], days: 3 }, '나');
  assert.equal(result.dateRange, '날짜 미정');
  assert.equal(result.days[2].date, 'DAY 3');
  assert.equal(result.days[0].places.length, 1);
  assert.equal(result.visibility, 'PRIVATE');
  assert.equal(result.isMine, true);
});

test('invalid dates, periods and empty titles are rejected before saving', () => {
  for (const days of [0, -1, 1.5, 31, NaN]) assert.equal(createJourneyFromPlaces({ ...options, days }, '나'), null);
  for (const startDate of ['2026-02-30', '2026-99-01', 'invalid']) assert.equal(createJourneyFromPlaces({ ...options, startDate }, '나'), null);
  assert.equal(createJourneyFromPlaces({ ...options, title: '  ' }, '나'), null);
});

test('creating twice gives independent visits and journey IDs', () => {
  const first = createJourneyFromPlaces(options, '나');
  const second = createJourneyFromPlaces(options, '나');
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.days[0].places[0].visitId, second.days[0].places[0].visitId);
});
